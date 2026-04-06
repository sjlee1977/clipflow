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
  desc: string;
  gender: 'female' | 'male';
};

export const MINIMAX_VOICES: MiniMaxVoice[] = [
  { id: 'Korean_SoothingLady',      name: 'Soothing',    desc: '부드러운',      gender: 'female' },
  { id: 'Korean_SweetGirl',         name: 'Sweet',       desc: '달콤한',        gender: 'female' },
  { id: 'Korean_ReliableSister',    name: 'Reliable',    desc: '믿음직한',      gender: 'female' },
  { id: 'Korean_MatureLady',        name: 'Mature',      desc: '성숙한',        gender: 'female' },
  { id: 'Korean_ThoughtfulWoman',   name: 'Thoughtful',  desc: '생각 깊은',     gender: 'female' },
  { id: 'Korean_SassyGirl',         name: 'Sassy',       desc: '톡톡 튀는',     gender: 'female' },
  { id: 'Korean_QuirkyGirl',        name: 'Quirky',      desc: '독특한',        gender: 'female' },
  { id: 'Korean_MysteriousGirl',    name: 'Mysterious',  desc: '신비로운',      gender: 'female' },
  { id: 'Korean_ShyGirl',           name: 'Shy',         desc: '수줍은',        gender: 'female' },
  { id: 'Korean_AirheadedGirl',     name: 'Airheaded',   desc: '엉뚱한',        gender: 'female' },
  { id: 'Korean_ReliableYouth',     name: 'Youth',       desc: '믿음직한',      gender: 'male'   },
  { id: 'Korean_OptimisticYouth',   name: 'Optimistic',  desc: '낙천적인',      gender: 'male'   },
  { id: 'Korean_IntellectualMan',   name: 'Intellectual', desc: '지적인',       gender: 'male'   },
  { id: 'Korean_IntellectualSenior',name: 'Senior',      desc: '지적인 어르신', gender: 'male'   },
  { id: 'Korean_LonelyWarrior',     name: 'Warrior',     desc: '고독한',        gender: 'male'   },
  { id: 'Korean_PlayboyCharmer',    name: 'Charmer',     desc: '매력적인',      gender: 'male'   },
  { id: 'Korean_PossessiveMan',     name: 'Possessive',  desc: '소유욕 있는',   gender: 'male'   },
  { id: 'Korean_StrictBoss',        name: 'Boss',        desc: '엄격한',        gender: 'male'   },
  { id: 'Korean_WiseTeacher',       name: 'Teacher',     desc: '현명한',        gender: 'male'   },
  { id: 'Korean_WiseElf',           name: 'Elf',         desc: '현명한 (엘프)', gender: 'male'   },
];

export type GenerateSpeechOptions = {
  voiceId?: string;
  speed?: number;
  pitch?: number;
  vol?: number;
  apiKey?: string;
  groupId?: string;
};

async function callMiniMax(voiceId: string, text: string, speed: number, apiKey: string, groupId: string): Promise<Response> {
  const url = `https://api.minimaxi.chat/v1/t2a_v2?GroupId=${groupId}`;
  
  const body = {
    model: 'speech-01-hd',
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

  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
  const { 
    voiceId = 'Korean_SoothingLady', 
    speed: rawSpeed = 1.0,
    apiKey = process.env.MINIMAX_API_KEY,
    groupId = process.env.MINIMAX_GROUP_ID
  } = options;

  if (!apiKey || !groupId) throw new Error('MiniMax API Key 또는 Group ID가 설정되지 않았습니다');

  const speed = Math.min(2.0, Math.max(0.5, rawSpeed));
  console.log('[minimax-tts] generating...', { text: text.slice(0, 20), voiceId });

  let res = await callMiniMax(voiceId, text, speed, apiKey, groupId);
  
  if (!res.ok) {
    const errText = await res.text();
    console.error('[minimax-tts] failed:', res.status, errText);
    
    if (res.status === 429) {
      for (let i = 1; i <= 2; i++) {
        await new Promise(r => setTimeout(r, 2000 * i));
        res = await callMiniMax(voiceId, text, speed, apiKey, groupId);
        if (res.ok) break;
      }
    }
  }

  if (!res.ok) {
    throw new Error(`MiniMax TTS 실패 (${res.status})`);
  }

  const rawText = await res.text();
  const lines = rawText.split('\n');
  let fullAudioString = '';
  
  // 에러 코드 의미 매핑
  const getErrorMessage = (code: number, msg: string) => {
    switch (code) {
      case 1004: return '잘못된 MiniMax API Key입니다. 설정 페이지에서 키를 다시 확인해주세요.';
      case 1013: return '잘못된 MiniMax Group ID입니다. 설정 페이지에서 ID를 다시 확인해주세요.';
      case 1021: return 'MiniMax 계정 잔액이 부족합니다. 충전이 필요합니다.';
      case 1022: return '해당 MiniMax 계정이 비활성화되었습니다.';
      case 2013: return 'MiniMax 요청량이 너무 많아 일시적으로 제한되었습니다. 잠시 후 시도해주세요.';
      case 1008:
      case 1039: return '대본에 MiniMax에서 금지하는 민감한 단어가 포함되어 있습니다. 내용을 수정해주세요.';
      default: return msg || `알 수 없는 API 에러 (코드: ${code})`;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    let jsonStr = trimmed;
    if (trimmed.startsWith('data:')) {
      jsonStr = trimmed.slice(5).trim();
    }
    
    try {
      const parsed = JSON.parse(jsonStr);
      
      // 상태 코드 확인 (base_resp 가 있으면 최우선, 없으면 루트 참조)
      const statusCode = parsed.base_resp?.status_code ?? parsed.status_code;
      const statusMsg = parsed.base_resp?.status_msg ?? parsed.status_msg ?? parsed.message;
      
      if (statusCode !== 0 && statusCode !== undefined) {
        throw new Error(`MiniMax API 에러: ${getErrorMessage(statusCode, statusMsg)} (코드: ${statusCode})`);
      }

      // 오디오 데이터 추출
      const audio = parsed.data?.audio || (typeof parsed.data === 'string' ? parsed.data : null) || parsed.audio || parsed.base64;
      
      if (typeof audio === 'string' && audio.length > 0) {
        fullAudioString += audio;
      } else if (typeof audio === 'object' && audio !== null) {
        fullAudioString += (audio.audio || audio.content || '');
      }
    } catch (e: any) {
      if (e.message.includes('MiniMax API 에러')) throw e;
      // SSE 공백이나 잘못된 JSON 라인 무시
    }
  }

  if (!fullAudioString) {
    throw new Error('응답에서 오디오 데이터를 찾을 수 없습니다.');
  }

  let buffer: Buffer;
  // HEX vs Base64 판별
  // 494433(ID3) 또는 fffb(MP3)로 시작하는지 체크 (Hex 기준)
  const isHex = /^[0-9a-fA-F]+$/.test(fullAudioString) && fullAudioString.length % 2 === 0;
  
  if (isHex) {
    console.log('[minimax-tts] Detected HEX encoding');
    buffer = Buffer.from(fullAudioString, 'hex');
  } else {
    console.log('[minimax-tts] Detected Base64 encoding');
    buffer = Buffer.from(fullAudioString, 'base64');
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
