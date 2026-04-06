/**
 * DashScope WanX (万相) & Qwen Image Generation Library
 * Optimized for Singapore International Endpoint (Final Stability Masterpiece V2)
 */

export type QwenImageOptions = {
  model?: string;
  size?: '1024*1024' | '1280*720' | '720*1280' | '960*960' | '1088*832' | '832*1088';
  style?: string;
  apiKey?: string;
};

/**
 * DashScope WanX 및 Qwen-Image 멀티모달 이미지 생성 (싱가포르 국제 엔드포인트 전용)
 */
export async function generateWanXImage(
  prompt: string,
  options: QwenImageOptions = {}
): Promise<string> {
  const {
    model = 'z-image-turbo', // 싱가포르 리전 표준 모델
    apiKey = process.env.QWEN_API_KEY
  } = options;

  // 싱가포르 리전 안정성을 위해 가장 표준적인 1024*1024를 기본으로 사용
  const size = '1024*1024';

  if (!apiKey) throw new Error('DashScope(Qwen) API 키가 설정되지 않았습니다');

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const timestamp = () => new Date().toLocaleTimeString();
  console.log(`[${timestamp()}] [wanx-image] Submitting request... model: ${model}, size: ${size}`);

  const submitUrl = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
  
  const res = await fetch(submitUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      input: {
        messages: [{ role: "user", content: [{ text: prompt }] }]
      },
      parameters: { size }
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WanX 이미지 생성 호출 실패 (${res.status}): ${errText}`);
  }

  const resultData = await res.json();
  
  // 1. 동기 응답 파싱
  let imageUrl = 
    resultData.output?.choices?.[0]?.message?.content?.find((c: any) => c.image_url)?.image_url ||
    resultData.output?.results?.[0]?.url;

  if (imageUrl) {
    console.log(`[${timestamp()}] [wanx-image] Immediate success!`);
    return imageUrl;
  }

  // 2. 비동기 작업 폴링 (task_id 기반)
  const taskId = resultData.output?.task_id || resultData.request_id;
  if (!taskId) {
    throw new Error('작업 ID를 생성할 수 없습니다.');
  }

  console.log(`[${timestamp()}] [wanx-image] Task ${taskId} started. Polling every 10s (Max 16 mins)...`);
  
  const pollUrl = `https://dashscope-intl.aliyuncs.com/api/v1/tasks/${taskId}`;
  // 싱가포르 리전의 극심한 지연을 감안하여 10초 간격으로 최대 100회(약 16분) 폴링
  for (let i = 0; i < 100; i++) {
    await new Promise(r => setTimeout(r, 10000));
    
    let pollData;
    try {
      const pollRes = await fetch(pollUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      if (!pollRes.ok) {
        console.warn(`[${timestamp()}] [wanx-image] Poll attempt ${i+1}/100 failed (${pollRes.status})`);
        continue;
      }
      pollData = await pollRes.json();
    } catch (e) {
      console.warn(`[${timestamp()}] [wanx-image] Network error during poll attempt ${i+1}`);
      continue;
    }

    const status = pollData.output?.task_status || pollData.status || 'UNKNOWN';
    console.log(`[${timestamp()}] [wanx-image] Task ${taskId} status: ${status} (${i+1}/100)`);

    if (status === 'SUCCEEDED') {
      const finalUrl = 
        pollData.output?.results?.[0]?.url || 
        pollData.output?.results?.[0]?.image_url ||
        pollData.output?.url || 
        pollData.output?.choices?.[0]?.message?.content?.find((c: any) => c.image_url)?.image_url;
      
      if (finalUrl) {
        console.log(`[${timestamp()}] [wanx-image] SUCCESS! URL Found.`);
        return finalUrl;
      }
      throw new Error('결과 URL을 찾을 수 없습니다.');
    }
    
    if (status === 'FAILED' || status === 'CANCELLED') {
      const errorMsg = pollData.output?.message || pollData.status_message || 'Unknown Server Error';
      throw new Error(`이미지 생성 실패: ${errorMsg}`);
    }
  }

  throw new Error('이미지 생성 대기 시간이 16분을 초과했습니다. 서버 부하가 극심합니다.');
}
