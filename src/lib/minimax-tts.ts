/**
 * MiniMax T2A V2 API - 고품질 한국어 음성 생성
 * 사용자 유료 계정(sk-api-...)을 활용합니다.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

export type MiniMaxVoice = {
  id: string;
  name: string;
  gender: 'female' | 'male';
};

export const MINIMAX_VOICES: MiniMaxVoice[] = [
  { id: 'Korean_SoothingLady',     name: '부드러운 여성', gender: 'female' },
  { id: 'Korean_SweetGirl',        name: '달콤한 소녀', gender: 'female' },
  { id: 'Korean_ReliableSister',   name: '믿음직한 누나', gender: 'female' },
  { id: 'Korean_MatureLady',       name: '성숙한 여성', gender: 'female' },
  { id: 'Korean_ThoughtfulWoman',  name: '생각 깊은 여성', gender: 'female' },
  { id: 'Korean_SassyGirl',        name: '톡톡 튀는 소녀', gender: 'female' },
  { id: 'Korean_QuirkyGirl',       name: '독특한 소녀', gender: 'female' },
  { id: 'Korean_MysteriousGirl',   name: '신비로운 소녀', gender: 'female' },
  { id: 'Korean_ShyGirl',          name: '수줍은 소녀', gender: 'female' },
  { id: 'Korean_AirheadedGirl',    name: '엉뚱한 소녀', gender: 'female' },
  { id: 'Korean_ReliableYouth',    name: '믿음직한 청년', gender: 'male' },
  { id: 'Korean_OptimisticYouth',  name: '낙천적인 청년', gender: 'male' },
  { id: 'Korean_IntellectualMan',  name: '지적인 남성', gender: 'male' },
  { id: 'Korean_IntellectualSenior',name: '지적인 어르신', gender: 'male' },
  { id: 'Korean_LonelyWarrior',    name: '고독한 전사', gender: 'male' },
  { id: 'Korean_PlayboyCharmer',   name: '매력적인 남성', gender: 'male' },
  { id: 'Korean_PossessiveMan',    name: '소유욕 있는 남성', gender: 'male' },
  { id: 'Korean_StrictBoss',       name: '엄격한 상사', gender: 'male' },
  { id: 'Korean_WiseTeacher',      name: '현명한 선생님', gender: 'male' },
  { id: 'Korean_WiseElf',          name: '현명한 엘프', gender: 'male' },
];

export type GenerateSpeechOptions = {
  voiceId?: string;
  speed?: number;
  pitch?: number;
  vol?: number;
};

async function callMiniMax(voiceId: string, text: string, speed: number): Promise<Response> {
  const url = `https://api.minimaxi.chat/v1/t2a_v2?GroupId=${process.env.MINIMAX_GROUP_ID}`;
  
  const body = {
    model: 'speech-01-hd', // 정석 모델명으로 회귀
    text,
    stream: false,
    voice_setting: {
      voice_id: voiceId,
      speed: speed,
      vol: 1.0,
      pitch: 0,
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3',
    },
  };

  console.log('[minimax-tts] Requesting with body:', JSON.stringify(body, null, 2).slice(0, 500));
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/** 텍스트 → MP3 Buffer (MiniMax T2A V2) */
export async function generateSpeech(
  text: string,
  options: GenerateSpeechOptions = {}
): Promise<{ buffer: Buffer; durationMs: number }> {
  const { voiceId = 'Korean_SoothingLady', speed: rawSpeed = 1.0 } = options;
  const speed = Math.min(2.0, Math.max(0.5, rawSpeed));

  console.log('[minimax-tts] generating...', { text: text.slice(0, 20), voiceId });

  let res = await callMiniMax(voiceId, text, speed);
  
  if (!res.ok) {
    const errText = await res.text();
    console.error('[minimax-tts] failed:', res.status, errText);
    
    if (res.status === 429) {
      for (let i = 1; i <= 2; i++) {
        await new Promise(r => setTimeout(r, 2000 * i));
        res = await callMiniMax(voiceId, text, speed);
        if (res.ok) break;
      }
    }
  }

  if (!res.ok) {
    throw new Error(`MiniMax TTS 실패 (${res.status})`);
  }

  const rawText = await res.text();
  let data: any;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[minimax-tts] JSON Parse Error:', rawText);
    throw new Error(`TTS API 응답 파싱 실패: ${rawText.slice(0, 100)}`);
  }

  if (data.base_resp?.status_code !== 0) {
    console.error('[minimax-tts] API Error Resp:', data);
    throw new Error(`MiniMax API 에러: ${data.base_resp?.status_msg}`);
  }

  // 여러 필드 후보 체크 (V2는 보통 data.data 또는 data)
  const audioData = data.data || data.audio || data.base64;
  if (!audioData) {
    console.error('[minimax-tts] No audio data field found:', data);
    throw new Error('응답에서 오디오 데이터를 찾을 수 없습니다.');
  }

  let buffer: Buffer;
  try {
    // V2는 보통 base64 string
    buffer = Buffer.from(audioData, 'base64');
    if (buffer.length < 100) {
      buffer = Buffer.from(audioData, 'hex');
    }
  } catch (e) {
    buffer = Buffer.from(audioData, 'hex');
  }
  
  if (!buffer || buffer.length === 0) {
    throw new Error('오디오 버퍼 생성 실패');
  }

  // MP3 비트레이트(128kbps) 기반 대략적인 길이 계산
  const durationMs = Math.round((buffer.byteLength * 8) / 128);
  console.log(`[minimax-tts] Generated: ${buffer.length} bytes, ~${durationMs}ms`);

  return { buffer, durationMs };
}

/** TTS 생성 후 S3 업로드 → URL 반환 */
export async function generateSpeechToS3(
  text: string,
  filename: string,
  options: GenerateSpeechOptions = {}
): Promise<{ url: string; durationMs: number }> {
  const { buffer, durationMs } = await generateSpeech(text, options);

  const key = `audio/${filename}.mp3`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'audio/mpeg',
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  return { url, durationMs };
}
