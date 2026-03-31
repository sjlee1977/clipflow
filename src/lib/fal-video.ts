/**
 * fal.ai Wan 2.1 Image-to-Video
 * 가성비 영상 생성 모델 (~$0.05/5초)
 */

const FAL_BASE = 'https://queue.fal.run';
const MODEL = 'fal-ai/wan/v2.1/image-to-video';

function headers(apiKey?: string) {
  return {
    'Authorization': `Key ${apiKey || process.env.FAL_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * 1단계: 이미지 → 영상 태스크 제출
 * status_url을 taskId로 반환 (직접 polling에 사용)
 */
export async function createFalVideoTask(
  imageUrl: string,
  prompt: string,
  duration?: 5 | 10,
  apiKey?: string
): Promise<string> {
  // WAN 2.1: num_frames 81 = 5초(16fps), 최대 81프레임까지 지원
  const numFrames = 81; // WAN v2.1은 최대 5초 고정
  console.log('[fal-video] createTask', { model: MODEL, imageUrl: imageUrl.slice(0, 80), numFrames });

  const res = await fetch(`${FAL_BASE}/${MODEL}`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      image_url: imageUrl,
      prompt: prompt || 'Cinematic motion, smooth camera movement, high quality',
      num_frames: numFrames,
    }),
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

  // fal.ai가 제공하는 URL을 우선 사용 (수동 구성 시 405 에러 발생 가능성 대비)
  const statusUrl = data.status_url || `${FAL_BASE}/${MODEL}/requests/${data.request_id}/status`;
  const responseUrl = data.response_url || `${FAL_BASE}/${MODEL}/requests/${data.request_id}`;
  console.log('[fal-video] status_url:', statusUrl, 'response_url:', responseUrl);
  return `${statusUrl}|${responseUrl}`;
}

/**
 * 2단계: 태스크 상태 조회
 * requestId는 status_url (전체 URL)
 */
export async function queryFalVideoTask(combined: string, apiKey?: string): Promise<{
  task_status: string;
  video_url?: string;
  task_status_msg?: string;
}> {
  const [statusUrl, responseUrl] = combined.includes('|') ? combined.split('|') : [combined, combined.replace(/\/status$/, '')];
  console.log('[fal-video] polling:', statusUrl);
  const statusRes = await fetch(statusUrl, { headers: headers(apiKey) });

  const statusRaw = await statusRes.text();
  console.log('[fal-video] status raw response:', statusRes.status, statusRaw.slice(0, 300));

  let statusData: any;
  try { statusData = JSON.parse(statusRaw); } catch {
    throw new Error(`fal.ai 상태 응답 파싱 실패 [${statusRes.status}]: ${statusRaw.slice(0, 200)}`);
  }

  if (statusData.status === 'COMPLETED') {
    // 1차: status 응답에 output이 포함된 경우
    const inlineUrl = statusData.output?.video?.url ?? statusData.video?.url;
    if (inlineUrl) {
      console.log('[fal-video] video url from status response:', inlineUrl);
      return { task_status: 'succeed', video_url: inlineUrl };
    }

    // 2차: response_url 별도 조회
    const resultRes = await fetch(responseUrl, { headers: headers(apiKey) });
    const resultRaw = await resultRes.text();
    console.log('[fal-video] result raw response:', resultRes.status, resultRaw.slice(0, 300));
    let result: any;
    try { result = JSON.parse(resultRaw); } catch {
      throw new Error(`fal.ai 결과 응답 파싱 실패 [${resultRes.status}]: ${resultRaw.slice(0, 200)}`);
    }
    const videoUrl = result.video?.url ?? result.output?.video?.url ?? result.videos?.[0]?.url;
    if (!videoUrl) {
      console.error('[fal-video] video_url not found in response:', resultRaw.slice(0, 300));
    }
    return { task_status: 'succeed', video_url: videoUrl };
  }

  if (statusData.status === 'FAILED') {
    return {
      task_status: 'failed',
      task_status_msg: statusData.error || '생성 실패',
    };
  }

  // IN_QUEUE | IN_PROGRESS
  return { task_status: 'processing' };
}
