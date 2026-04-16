/**
 * fal.ai 영상 생성 라이브러리
 * - WAN 2.1 image-to-video
 * - Seedance 2.0 image-to-video (Early Access)
 */

const FAL_QUEUE = 'https://queue.fal.run';

function headers(apiKey?: string) {
  return {
    'Authorization': `Key ${apiKey || process.env.FAL_KEY}`,
    'Content-Type': 'application/json',
  };
}

// 모델 ID → fal.ai 엔드포인트 매핑
const MODEL_ENDPOINTS: Record<string, string> = {
  'fal-wan-v2.1':       'fal-ai/wan/v2.1/image-to-video',
  'fal-seedance-2':     'bytedance/seedance-2.0/image-to-video',
  'fal-seedance-2-fast':'bytedance/seedance-2.0/image-to-video/fast',
};

function getEndpoint(modelId: string): string {
  return MODEL_ENDPOINTS[modelId] ?? MODEL_ENDPOINTS['fal-wan-v2.1'];
}

function buildBody(modelId: string, imageUrl: string, prompt: string, duration: 5 | 10) {
  if (modelId.startsWith('fal-seedance')) {
    return JSON.stringify({
      image_url: imageUrl,
      prompt: prompt || 'Cinematic motion, smooth camera movement, high quality',
      duration: String(duration),  // Seedance: string "5" | "10"
      resolution: '720p',
    });
  }
  // WAN 2.1: num_frames (81 = 5초@16fps)
  return JSON.stringify({
    image_url: imageUrl,
    prompt: prompt || 'Cinematic motion, smooth camera movement, high quality',
    num_frames: 81,
  });
}

/**
 * 1단계: 영상 태스크 제출 → status_url|response_url 반환
 */
export async function createFalVideoTask(
  imageUrl: string,
  prompt: string,
  duration: 5 | 10 = 5,
  apiKey?: string,
  modelId = 'fal-wan-v2.1',
): Promise<string> {
  const endpoint = getEndpoint(modelId);
  console.log('[fal-video] createTask', { model: endpoint, imageUrl: imageUrl.slice(0, 80) });

  const res = await fetch(`${FAL_QUEUE}/${endpoint}`, {
    method: 'POST',
    headers: headers(apiKey),
    body: buildBody(modelId, imageUrl, prompt, duration),
  });

  const rawText = await res.text();
  console.log('[fal-video] submit response:', res.status, rawText.slice(0, 300));

  let data: any;
  try { data = JSON.parse(rawText); } catch {
    throw new Error(`fal.ai 응답 파싱 실패: ${rawText.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`fal.ai 오류 [${res.status}]: ${data?.detail || rawText.slice(0, 200)}`);
  }

  if (!data.request_id) {
    throw new Error(`request_id 없음. 응답: ${rawText.slice(0, 200)}`);
  }

  const statusUrl = data.status_url || `${FAL_QUEUE}/${endpoint}/requests/${data.request_id}/status`;
  const responseUrl = data.response_url || `${FAL_QUEUE}/${endpoint}/requests/${data.request_id}`;
  console.log('[fal-video] status_url:', statusUrl);
  return `${statusUrl}|${responseUrl}`;
}

/**
 * 2단계: 태스크 상태 조회
 */
export async function queryFalVideoTask(combined: string, apiKey?: string): Promise<{
  task_status: string;
  video_url?: string;
  task_status_msg?: string;
}> {
  const [statusUrl, responseUrl] = combined.includes('|')
    ? combined.split('|')
    : [combined, combined.replace(/\/status$/, '')];

  console.log('[fal-video] polling:', statusUrl);
  const statusRes = await fetch(statusUrl, { headers: headers(apiKey) });
  const statusRaw = await statusRes.text();
  console.log('[fal-video] status raw:', statusRes.status, statusRaw.slice(0, 300));

  let statusData: any;
  try { statusData = JSON.parse(statusRaw); } catch {
    throw new Error(`fal.ai 상태 파싱 실패 [${statusRes.status}]: ${statusRaw.slice(0, 200)}`);
  }

  if (statusData.status === 'COMPLETED') {
    // 1차: status 응답에 output 포함된 경우
    const inlineUrl = statusData.output?.video?.url ?? statusData.video?.url;
    if (inlineUrl) {
      return { task_status: 'succeed', video_url: inlineUrl };
    }

    // 2차: response_url 별도 조회
    const resultRes = await fetch(responseUrl, { headers: headers(apiKey) });
    const resultRaw = await resultRes.text();
    console.log('[fal-video] result raw:', resultRes.status, resultRaw.slice(0, 300));
    let result: any;
    try { result = JSON.parse(resultRaw); } catch {
      throw new Error(`fal.ai 결과 파싱 실패 [${resultRes.status}]: ${resultRaw.slice(0, 200)}`);
    }
    const videoUrl = result.video?.url ?? result.output?.video?.url ?? result.videos?.[0]?.url;
    return { task_status: 'succeed', video_url: videoUrl };
  }

  if (statusData.status === 'FAILED') {
    return { task_status: 'failed', task_status_msg: statusData.error || '생성 실패' };
  }

  return { task_status: 'processing' };
}
