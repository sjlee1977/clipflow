/**
 * 이미지 → 영상 클립 변환 (4종 프로바이더 통합)
 * - none     : 정적 이미지 (Ken Burns, 기본값)
 * - kling    : Kling AI API
 * - hailuo   : Minimax Hailuo Video API
 * - wan      : Wan 2.1 via fal.ai
 * - seedance : ByteDance Seedance 1.5 Pro via OpenRouter (Alpha)
 */

export type VideoProvider = 'none' | 'kling' | 'hailuo' | 'wan' | 'seedance';

export type VideoProviderMeta = {
  id: VideoProvider;
  name: string;
  price: string;
  quality: string;
  note?: string;
};

export const VIDEO_PROVIDERS: VideoProviderMeta[] = [
  { id: 'none',     name: '정적 이미지',         price: '무료',         quality: 'Ken Burns 효과' },
  { id: 'wan',      name: 'Wan 2.1 (fal.ai)',   price: '~$0.02/클립', quality: '★★★☆' },
  { id: 'hailuo',   name: 'Minimax Hailuo',      price: '~$0.04/클립', quality: '★★★☆' },
  { id: 'kling',    name: 'Kling V1.6',          price: '~$0.07/클립', quality: '★★★★' },
  { id: 'seedance', name: 'Seedance 1.5 Pro',    price: '무료(Alpha)', quality: '★★★★', note: 'OpenRouter Alpha' },
];

/** 이미지 URL → 영상 클립 URL */
export async function generateVideoClip(
  imageUrl: string,
  prompt: string,
  provider: VideoProvider,
): Promise<string> {
  switch (provider) {
    case 'kling':    return generateKlingClip(imageUrl, prompt);
    case 'hailuo':   return generateHailuoClip(imageUrl, prompt);
    case 'wan':      return generateWanClip(imageUrl, prompt);
    case 'seedance': return generateSeedanceClip(imageUrl, prompt);
    default:         return imageUrl; // 정적 이미지 그대로 반환
  }
}

/* ── Kling ─────────────────────────────────────────────────────── */
async function generateKlingClip(imageUrl: string, prompt: string): Promise<string> {
  const { imageToVideo } = await import('./kling');
  return imageToVideo(imageUrl, prompt, 'kling-v1-6-std-5s');
}

/* ── Minimax Hailuo ────────────────────────────────────────────── */
async function generateHailuoClip(imageUrl: string, prompt: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY 없음');

  // 1. 영상 생성 요청
  const createRes = await fetch('https://api.minimaxi.chat/v1/video_generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'video-01',
      prompt: prompt || 'Cinematic motion, smooth camera movement',
      first_frame_image: imageUrl,
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(createData.base_resp?.status_msg || 'Hailuo 요청 실패');
  const taskId = createData.task_id;
  if (!taskId) throw new Error('Hailuo task_id 없음');

  // 2. 완료 폴링 (최대 10분)
  const maxWait = 10 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 5000));

    const pollRes = await fetch(`https://api.minimaxi.chat/v1/query/video_generation?task_id=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const pollData = await pollRes.json();
    const status = pollData.status;

    if (status === 'Success') {
      const url = pollData.file_id
        ? await getHailuoDownloadUrl(pollData.file_id, apiKey)
        : pollData.video_url;
      if (!url) throw new Error('Hailuo 영상 URL 없음');
      return url;
    }
    if (status === 'Fail') throw new Error('Hailuo 영상 생성 실패');
  }

  throw new Error('Hailuo 영상 생성 타임아웃');
}

async function getHailuoDownloadUrl(fileId: string, apiKey: string): Promise<string> {
  const res = await fetch(`https://api.minimaxi.chat/v1/files/retrieve?GroupId=${process.env.MINIMAX_GROUP_ID}&file_id=${fileId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await res.json();
  return data.file?.download_url ?? '';
}

/* ── Wan 2.1 (fal.ai) ──────────────────────────────────────────── */
async function generateWanClip(imageUrl: string, prompt: string): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY 없음');

  const MODEL = 'fal-ai/wan/v2.1/image-to-video';

  // 1. 요청 제출
  const submitRes = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt: prompt || 'Cinematic motion, smooth camera movement',
      duration: '5',
    }),
  });

  const submitData = await submitRes.json();
  if (!submitRes.ok) throw new Error(submitData.detail || 'Wan 요청 실패');
  const requestId = submitData.request_id;
  if (!requestId) throw new Error('Wan request_id 없음');

  // 2. 완료 폴링 (최대 10분)
  const maxWait = 10 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 5000));

    const statusRes = await fetch(`https://queue.fal.run/${MODEL}/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${falKey}` },
    });
    const statusData = await statusRes.json();

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/${MODEL}/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${falKey}` },
      });
      const result = await resultRes.json();
      const url = result.video?.url;
      if (!url) throw new Error('Wan 영상 URL 없음');
      return url;
    }
    if (statusData.status === 'FAILED') throw new Error('Wan 영상 생성 실패');
  }

  throw new Error('Wan 영상 생성 타임아웃');
}

/* ── Seedance 1.5 Pro (OpenRouter Alpha) ───────────────────────── */
async function generateSeedanceClip(imageUrl: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY 없음');

  // 1. 요청 제출
  const submitRes = await fetch('https://openrouter.ai/api/v1/videos/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://clipflow.app',
      'X-Title': 'ClipFlow',
    },
    body: JSON.stringify({
      model: 'bytedance/seedance-1-5-pro',
      prompt: prompt || 'Cinematic motion, smooth camera movement',
      image_url: imageUrl,
      duration: 5,
    }),
  });

  const submitData = await submitRes.json();
  if (!submitRes.ok) throw new Error(submitData.error?.message || 'Seedance 요청 실패');

  // 동기 응답 (즉시 URL)
  const directUrl = submitData.data?.[0]?.url;
  if (directUrl) return directUrl;

  // 비동기 응답 (task_id 폴링)
  const taskId = submitData.id ?? submitData.task_id;
  if (!taskId) throw new Error('Seedance task_id 없음');

  const maxWait = 10 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 5000));

    const pollRes = await fetch(`https://openrouter.ai/api/v1/videos/generations/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const pollData = await pollRes.json();

    if (pollData.status === 'succeeded' || pollData.data?.[0]?.url) {
      const url = pollData.data?.[0]?.url ?? pollData.output?.url;
      if (!url) throw new Error('Seedance 영상 URL 없음');
      return url;
    }
    if (pollData.status === 'failed') throw new Error('Seedance 영상 생성 실패');
  }

  throw new Error('Seedance 영상 생성 타임아웃');
}
