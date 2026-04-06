import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import WebSocket from 'ws';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

export type QwenVoice = {
  id: string;
  name: string;
  desc: string;
  gender: 'female' | 'male';
};

/**
 * CosyVoice v3-flash 공식 목소리 목록 (공식 문서 확인)
 * - 한국어 지원: loongkyong_v3 (Korean female)
 * - 중국어/영어 지원: longanyang, longanhuan 등 (한국어 텍스트 사용 불가)
 */
export const QWEN_VOICES: QwenVoice[] = [
  // ─── 한국어 지원 ───────────────────────────────────────
  { id: 'loongkyong_v3', name: 'Kyong (한국어)',  desc: '한국어 여성 목소리',      gender: 'female' },
  // ─── 중국어/영어 지원 (다국어 콘텐츠용) ──────────────────
  { id: 'longanyang',    name: 'Anyang (중/영)',  desc: '밝고 젊은 남성',          gender: 'male'   },
  { id: 'longanhuan',   name: 'Anhuan (중/영)',  desc: '활기차고 명랑한 여성',    gender: 'female' },
  { id: 'longxiaochun_v3', name: 'Xiaochun (중/영)', desc: '지적인 여성', gender: 'female' },
  { id: 'longanmin_v3', name: 'Anmin (중/영)',   desc: '순수한 젊은 여성',        gender: 'female' },
  { id: 'longanlang_v3', name: 'Anlang (중/영)', desc: '산뜻한 젊은 남성',        gender: 'male'   },
];

export type QwenSpeechOptions = {
  voiceId?: string;
  model?: string;
  speed?: number;
  pitch?: number;
  apiKey?: string;
};

/**
 * DashScope CosyVoice v3-flash - WebSocket 기반 TTS
 * 싱가포르 리전 국제 계정용
 * WSS: wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference
 */
export async function generateSpeech(
  text: string,
  options: QwenSpeechOptions = {}
): Promise<{ buffer: Buffer; durationMs: number }> {
  const {
    voiceId = 'loongkyong_v3',  // 한국어 지원 공식 목소리
    model = 'cosyvoice-v3-flash',
    speed = 1.0,
    apiKey = process.env.QWEN_API_KEY
  } = options;

  const cleanApiKey = (apiKey ?? '').trim();
  if (!cleanApiKey) throw new Error('DashScope(Qwen) API 키가 설정되지 않았습니다');

  console.log(`[qwen-tts] WSS model=${model}, voice=${voiceId}, text="${text.slice(0, 20)}"`);

  const wsUrl = 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference';

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${cleanApiKey}`,
        'X-DashScope-DataInspection': 'enable',
      },
    });

    const audioChunks: Buffer[] = [];
    let taskId = '';
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Qwen TTS WebSocket 타임아웃 (30초)'));
    }, 30000);

    ws.on('open', () => {
      // 1. run-task 메시지 전송
      taskId = `task-${Date.now()}`;
      const runTask = {
        header: {
          action: 'run-task',
          task_id: taskId,
          streaming: 'duplex',
        },
        payload: {
          task_group: 'audio',
          task: 'tts',
          function: 'SpeechSynthesizer',
          model,
          parameters: {
            text_type: 'PlainText',
            voice: voiceId,
            format: 'mp3',
            sample_rate: 22050,
            rate: speed,
            pitch: 1,
            volume: 50,
          },
          resources: [],
          input: {},
        },
      };
      ws.send(JSON.stringify(runTask));

      // 2. 텍스트 전송 (continue-task)
      const continueTask = {
        header: {
          action: 'continue-task',
          task_id: taskId,
          streaming: 'duplex',
        },
        payload: {
          input: { text },
        },
      };
      ws.send(JSON.stringify(continueTask));

      // 3. 완료 신호 (finish-task)
      const finishTask = {
        header: {
          action: 'finish-task',
          task_id: taskId,
          streaming: 'duplex',
        },
        payload: {
          input: {},
        },
      };
      ws.send(JSON.stringify(finishTask));
    });

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // 바이너리 → 오디오 데이터
        audioChunks.push(Buffer.from(data));
      } else {
        try {
          const msg = JSON.parse(data.toString());
          const event = msg?.header?.event;
          if (event === 'task-failed') {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`TTS 작업 실패: ${JSON.stringify(msg)}`));
          } else if (event === 'task-finished') {
            clearTimeout(timeout);
            ws.close();
            // resolve는 ws.on('close')에서 처리
          }
        } catch {
          // JSON 파싱 실패는 무시
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (audioChunks.length === 0) {
        reject(new Error('오디오 데이터가 없습니다 (빈 응답)'));
        return;
      }
      const buffer = Buffer.concat(audioChunks);
      const durationMs = Math.round((buffer.byteLength * 8) / 128);
      console.log(`[qwen-tts] OK: ${buffer.length} bytes, ~${durationMs}ms`);
      resolve({ buffer, durationMs });
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Qwen TTS WebSocket 오류: ${err.message}`));
    });
  });
}

/** TTS 생성 후 S3 업로드 → URL 반환 */
export async function generateSpeechToS3(
  text: string,
  filename: string,
  options: QwenSpeechOptions = {}
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
