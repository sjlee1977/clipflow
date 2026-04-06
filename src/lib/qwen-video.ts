/**
 * DashScope WanX-Video (万相-视频) Generation Library
 * Updated based on official screenshot (US region endpoint & structure)
 */

export type QwenVideoOptions = {
  model?: string;
  size?: '1280*720' | '720*1280';
  imgUrl?: string; // Image-to-Video 지원 시 필요
  apiKey?: string;
  duration?: number;
};

/**
 * DashScope WanX 비디오 생성 (비동기 폴링 포함 - 단일 호출용)
 */
export async function generateWanXVideo(
  prompt: string,
  options: QwenVideoOptions = {}
): Promise<string> {
  const {
    model = 'wan2.1-i2v-plus',
    imgUrl,
    apiKey = process.env.QWEN_API_KEY,
    duration = 5
  } = options;

  if (!apiKey) throw new Error('DashScope(Qwen) API 키가 설정되지 않았습니다');

  // 작업 제출
  const taskId = await createWanXVideoTask(imgUrl || '', prompt, model, duration, apiKey);

  // 상태 폴링
  const MAX_POLLS = 200;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await queryWanXVideoTask(taskId, apiKey);
    if (status.task_status === 'succeed' && status.video_url) return status.video_url;
    if (status.task_status === 'failed') throw new Error(`영상 생성 실패: ${status.message}`);
  }
  throw new Error('WanX 비디오 생성 시간 초과');
}

/**
 * DashScope WanX 비디오 작업 생성 (스크린샷 기반 구조 업데이트)
 */
export async function createWanXVideoTask(
  imgUrl: string,
  prompt: string,
  modelId: string,
  duration: number,
  apiKey: string
): Promise<string> {
  // 국제 표준 전용 엔드포인트 (-intl) 사용
  const submitUrl = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis';
  
  const body: any = {
    model: modelId,
    input: {
      prompt,
    },
    parameters: {
      resolution: "720P",
      prompt_extend: true,
      duration: duration || 5,
      shot_type: "multi"
    }
  };

  // 스크린샷에 명시된 필드명 "img_url" 사용 (기존 image_url 대신)
  if (imgUrl) body.input.img_url = imgUrl;

  const res = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-ApiKey': apiKey,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WanX 비디오 작업 생성 실패: ${errText}`);
  }

  const data = await res.json();
  if (!data.output?.task_id) throw new Error(`TaskId 생성 실패: ${JSON.stringify(data)}`);
  return data.output.task_id;
}

/**
 * DashScope WanX 비디오 작업 상태 조회 (국제 표준 엔드포인트)
 */
export async function queryWanXVideoTask(taskId: string, apiKey: string) {
  const pollUrl = `https://dashscope-intl.aliyuncs.com/api/v1/tasks/${taskId}`;
  const res = await fetch(pollUrl, {
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-ApiKey': apiKey 
    }
  });
  
  if (!res.ok) throw new Error('WanX 작업 조회 실패');

  const data = await res.json();
  const status = data.output.task_status;

  return {
    task_status: status === 'SUCCEEDED' ? 'succeed' : (status === 'FAILED' || status === 'UNKNOWN') ? 'failed' : 'processing',
    video_url: data.output.video_url || null,
    message: data.output.message || ''
  };
}
