import { SceneSplitResult } from './google';

/**
 * DashScope Qwen (通义千问) LLM Library for Scene Splitting
 *
 * 전략: 텍스트 분할은 코드로 처리 (원본 100% 보장)
 *       LLM은 imagePrompt / motionPrompt / 애니메이션 설정만 담당
 */

// ── 1단계: 원본 텍스트를 코드로 분할 ──────────────────────────────────────────
function splitScriptToChunks(script: string, sceneCount: number): string[] {
  const totalLen = script.length;
  const targetLen = totalLen / sceneCount;
  const chunks: string[] = [];
  let pos = 0;

  for (let i = 0; i < sceneCount; i++) {
    if (i === sceneCount - 1) {
      // 마지막 씬은 남은 텍스트 전체
      chunks.push(script.slice(pos).trim());
      break;
    }

    const idealEnd = Math.round(pos + targetLen);

    // 이상적인 위치 근처에서 자연스러운 문장 끊기 찾기 (±30자 범위)
    const searchStart = Math.max(pos + Math.floor(targetLen * 0.7), pos + 1);
    const searchEnd   = Math.min(idealEnd + 30, totalLen - 1);

    let cutPos = idealEnd;

    // 1순위: 문장 종결 (. ! ? … 。) 뒤 공백
    for (let j = Math.min(searchEnd, totalLen - 1); j >= searchStart; j--) {
      if (/[.!?…。]/.test(script[j]) && (j + 1 >= totalLen || script[j + 1] === ' ' || script[j + 1] === '\n')) {
        cutPos = j + 1;
        break;
      }
    }

    // 2순위: 줄바꿈
    if (cutPos === idealEnd) {
      for (let j = searchEnd; j >= searchStart; j--) {
        if (script[j] === '\n') { cutPos = j + 1; break; }
      }
    }

    // 3순위: 공백
    if (cutPos === idealEnd) {
      for (let j = searchEnd; j >= searchStart; j--) {
        if (script[j] === ' ') { cutPos = j + 1; break; }
      }
    }

    const chunk = script.slice(pos, cutPos).trim();
    if (chunk.length > 0) chunks.push(chunk);
    pos = cutPos;
  }

  // 빈 청크 제거
  return chunks.filter(c => c.trim().length > 0);
}

// ── 2단계: LLM으로 각 씬의 이미지/모션 프롬프트 생성 ─────────────────────────
async function generateScenePrompts(
  chunks: string[],
  hasCharacter: boolean,
  apiKey: string,
  modelId: string,
  allowedAnimations: string[],
  imageStyle: string,
  subCharacterNames: string[],
): Promise<Array<{
  imagePrompt: string;
  motionPrompt: string;
  shouldAnimate: boolean;
  textAnimationStyle: string;
  displayText?: string;
}>> {
  const isKineticMode = imageStyle === 'kinetic';
  const animList = allowedAnimations.length > 0 ? allowedAnimations.join(', ') : 'none';
  const maxAnimate = Math.floor(chunks.length * 0.2);

  const charPrefix = hasCharacter ? 'same character as reference image, ' : '';
  const subCharNote = subCharacterNames.length > 0
    ? `Sub-characters available: ${subCharacterNames.join(', ')}. Include them naturally when scene content fits.`
    : '';

  const sceneSummaries = chunks.map((c, i) => `[Scene ${i + 1}] ${c.slice(0, 80)}${c.length > 80 ? '...' : ''}`).join('\n');

  const systemPrompt = `You are a video production expert. Generate image prompts and animation settings for each scene in JSON format.`;

  const userPrompt = `Generate prompts for ${chunks.length} video scenes. Return ONLY valid JSON array.

Character note: ${charPrefix ? `Prefix every imagePrompt with "${charPrefix}"` : 'No specific character.'}
${subCharNote}

Rules:
- Return JSON array of exactly ${chunks.length} objects
- shouldAnimate: at most ${maxAnimate} scenes can be true (max 20% of total)
- textAnimationStyle: choose from [${animList}], apply to 40-60% of scenes
${isKineticMode ? '- displayText: impactful 1-5 word phrase in Korean for each scene' : ''}

Each object fields:
- imagePrompt (string): Vivid English image generation prompt, ~200 chars${isKineticMode ? '. Set to ""' : ''}
- motionPrompt (string): English motion description — person body movement + environment movement, ~150 chars
- shouldAnimate (boolean): true for climax/key emotional scenes only
- textAnimationStyle (string): one of [${animList}]${isKineticMode ? '\n- displayText (string): 5-15 char Korean impact phrase' : ''}

Scenes to generate prompts for:
${sceneSummaries}

Return format:
[
  {"imagePrompt":"...","motionPrompt":"...","shouldAnimate":false,"textAnimationStyle":"..."},
  ...
]`;

  let effectiveModel = modelId;
  const lowerId = modelId.toLowerCase();
  if (lowerId.includes('deepseek-r1')) effectiveModel = 'deepseek-r1';
  else if (lowerId.includes('deepseek')) effectiveModel = 'deepseek-v3';
  else if (lowerId.includes('max')) effectiveModel = 'qwen-max';
  else if (lowerId.includes('plus')) effectiveModel = 'qwen-plus';
  else if (lowerId.includes('turbo') || lowerId.includes('flash')) effectiveModel = 'qwen-turbo';
  else if (lowerId.includes('omni')) effectiveModel = 'qwen-omni-turbo';

  const endpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: effectiveModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 16000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qwen 프롬프트 생성 실패 (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  // JSON 추출 (마크다운 코드블록 제거)
  let jsonStr = content.trim();
  const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();

  // 배열 추출
  const arrStart = jsonStr.indexOf('[');
  const arrEnd   = jsonStr.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1) jsonStr = jsonStr.slice(arrStart, arrEnd + 1);

  const parsed: Array<{
    imagePrompt: string;
    motionPrompt: string;
    shouldAnimate: boolean;
    textAnimationStyle: string;
    displayText?: string;
  }> = JSON.parse(jsonStr);

  return parsed;
}

// ── 메인 함수 ─────────────────────────────────────────────────────────────────
export async function splitScriptViaQwen(
  script: string,
  modelId: string,
  sceneCount: number,
  hasCharacter: boolean,
  apiKey: string,
  subCharacterNames: string[] = [],
  allowedAnimations: string[] = [],
  imageStyle?: string
): Promise<SceneSplitResult> {

  // 1단계: 텍스트를 코드로 정확히 분할 (원본 100% 보장)
  const chunks = splitScriptToChunks(script, sceneCount);
  const actualCount = chunks.length;

  // 2단계: LLM으로 이미지/모션 프롬프트만 생성
  const prompts = await generateScenePrompts(
    chunks, hasCharacter, apiKey, modelId,
    allowedAnimations, imageStyle ?? '', subCharacterNames
  );

  // 3단계: 결합
  const scenes = chunks.map((text, i) => {
    const p = prompts[i] ?? {
      imagePrompt: '', motionPrompt: '', shouldAnimate: false, textAnimationStyle: 'none',
    };
    return {
      text,
      imagePrompt: p.imagePrompt ?? '',
      motionPrompt: p.motionPrompt ?? '',
      shouldAnimate: p.shouldAnimate ?? false,
      textAnimationStyle: (p.textAnimationStyle ?? 'none') as 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom' | 'clock-spin' | 'pulse-ring' | 'sparkle' | 'confetti' | 'rain' | 'snow' | 'fire' | 'heart' | 'stars' | 'thunder' | 'chart-up' | 'film-roll' | 'magnifier' | 'lock-secure' | 'camera-flash',
      ...(imageStyle === 'kinetic' && { displayText: p.displayText ?? '' }),
    };
  });

  return {
    scenes,
    usage: { promptTokens: 0, completionTokens: 0 },
  };
}
