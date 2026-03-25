/**
 * MiniMax Video Generation API (Hailuo)
 * 3-step async: create task → query status (file_id) → retrieve download URL
 */

const BASE = 'https://api.minimaxi.chat/v1';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    return JSON.parse(match[0]);
  } catch {
    console.error('[minimax-video] parse error:', text);
    throw new Error('API 응답 파싱 실패');
  }
}

/**
 * 1단계: 이미지 → 영상 작업 생성 → task_id 반환
 */
export async function createVideoTask(
  imageUrl: string,
  prompt: string,
  model = 'MiniMax-Hailuo-2.3-Fast'
): Promise<string> {
  const res = await fetch(`${BASE}/video_generation`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model,
      prompt: prompt || 'Cinematic motion, high quality',
      first_frame_image: imageUrl,
    }),
  });

  const data = await parseJson(res);
  if (data.base_resp?.status_code !== 0) {
    throw new Error(data.base_resp?.status_msg || '비디오 생성 태스크 시작 실패');
  }
  if (!data.task_id) throw new Error('task_id가 반환되지 않았습니다');
  return data.task_id as string;
}

/**
 * 2단계: 작업 상태 조회
 * 완료 시 file_id 반환 → 3단계에서 download URL 획득 필요
 */
export async function queryVideoTask(taskId: string): Promise<{
  task_status: string;
  video_url?: string;
  task_status_msg?: string;
}> {
  const res = await fetch(
    `${BASE}/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
    { headers: headers() }
  );

  const data = await parseJson(res);
  if (data.base_resp?.status_code !== 0) {
    throw new Error(data.base_resp?.status_msg || '비디오 상태 확인 실패');
  }

  // status: 'Processing' | 'Success' | 'Fail'
  const statusMap: Record<string, string> = {
    Processing: 'processing',
    Success: 'succeed',
    Fail: 'failed',
  };
  const task_status = statusMap[data.status] ?? data.task_status ?? 'processing';

  // 완료 시: file_id로 download URL 조회
  let video_url: string | undefined = data.video_url;
  if (task_status === 'succeed' && !video_url && data.file_id) {
    video_url = await retrieveVideoFile(data.file_id);
  }

  return { task_status, video_url, task_status_msg: data.base_resp?.status_msg };
}

/**
 * 3단계: file_id → 다운로드 URL 획득
 */
export async function retrieveVideoFile(fileId: string): Promise<string> {
  const res = await fetch(
    `${BASE}/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
    { headers: headers() }
  );

  const data = await parseJson(res);
  const url = data.file?.download_url;
  if (!url) throw new Error('download_url이 없습니다');
  return url as string;
}
