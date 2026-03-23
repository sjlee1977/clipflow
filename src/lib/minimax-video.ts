/**
 * MiniMax - Hailuo AI (Video Generation)
 * https://api.minimax.io
 */

export type VideoGenResponse = {
  base_resp: { status_code: number; status_msg: string };
  task_id: string;
};

export type VideoQueryResponse = {
  base_resp: { status_code: number; status_msg: string };
  task_status: 'preparing' | 'processing' | 'succeed' | 'failed';
  task_status_msg: string;
  file_id: string;
  video_url: string;
};

/**
 * 이미지 기반 비디오 생성 태스크 시작
 */
export async function createVideoTask(imageUrl: string, prompt: string) {
  const url = `https://api.minimaxi.chat/v1/video_generation?GroupId=${process.env.MINIMAX_GROUP_ID}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "video-01",
      prompt: prompt || "Cinematic motion, high quality",
      first_frame_image: imageUrl,
    }),
  });

  const rawText = await res.text();
  let data: VideoGenResponse;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[createVideoTask] JSON Parse Error:', rawText);
    throw new Error('비디오 생성 API 응답 형식이 올바르지 않습니다.');
  }

  if (!res.ok || data.base_resp.status_code !== 0) {
    throw new Error(data.base_resp.status_msg || '비디오 생성 태스크 시작 실패');
  }

  return data.task_id;
}

/**
 * 태스크 상태 확인
 */
export async function queryVideoTask(taskId: string) {
  const url = `https://api.minimaxi.chat/v1/query/video_generation?GroupId=${process.env.MINIMAX_GROUP_ID}&task_id=${taskId}`;
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
  });

  const rawText = await res.text();
  let data: VideoQueryResponse;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[queryVideoTask] JSON Parse Error:', rawText);
    throw new Error('비디오 상태 조회 API 응답 형식이 올바르지 않습니다.');
  }

  if (!res.ok || data.base_resp.status_code !== 0) {
    throw new Error(data.base_resp.status_msg || '비디오 상태 확인 실패');
  }

  return data;
}
