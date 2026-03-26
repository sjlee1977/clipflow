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
 * S3 URL → base64 data URI 변환 (MiniMax가 S3 URL을 직접 못 읽을 경우 대비)
 */
async function toBase64DataUri(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:')) return imageUrl;
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${imageUrl}`);
  const buf = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${contentType};base64,${b64}`;
}

/**
 * 1단계: 이미지 → 영상 작업 생성 → task_id 반환
 */
export async function createVideoTask(
  imageUrl: string,
  prompt: string,
  model = 'MiniMax-Hailuo-2.3-Fast'
): Promise<string> {
  const groupId = process.env.MINIMAX_GROUP_ID;
  const url = groupId
    ? `${BASE}/video_generation?GroupId=${groupId}`
    : `${BASE}/video_generation`;

  // S3 URL을 base64로 변환 (MiniMax 서버에서 외부 URL 접근 불가 방어)
  const firstFrameImage = await toBase64DataUri(imageUrl);
  console.log('[minimax-video] createVideoTask', { url, model, imageType: firstFrameImage.startsWith('data:') ? 'base64' : 'url' });

  const body = {
    model,
    prompt: prompt || 'Cinematic motion, high quality',
    first_frame_image: firstFrameImage,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  console.log('[minimax-video] response status:', res.status, 'body:', rawText.slice(0, 400));

  let data: any;
  try {
    const match = rawText.match(/\{[\s\S]*\}/);
    data = match ? JSON.parse(match[0]) : {};
  } catch {
    throw new Error(`MiniMax Video API 응답 파싱 실패: ${rawText.slice(0, 200)}`);
  }

  const statusCode = data.base_resp?.status_code;
  const statusMsg = data.base_resp?.status_msg;
  if (statusCode !== undefined && statusCode !== 0) {
    throw new Error(`MiniMax Video 오류 [${statusCode}]: ${statusMsg}`);
  }
  if (!data.task_id) {
    throw new Error(`task_id 없음. 응답: ${rawText.slice(0, 200)}`);
  }
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
