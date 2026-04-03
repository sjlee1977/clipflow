import { GoogleGenAI } from '@google/genai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

let ai: GoogleGenAI;
function getAI(apiKey?: string) {
  if (apiKey) return new GoogleGenAI({ apiKey });
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다');
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

export type GoogleVoice = {
  id: string;
  name: string;
  desc: string;
  gender: 'female' | 'male';
};

export const GOOGLE_VOICES: GoogleVoice[] = [
  { id: 'Kore',   name: 'Kore',   desc: '차분한',   gender: 'female' },
  { id: 'Aoede',  name: 'Aoede',  desc: '밝은',     gender: 'female' },
  { id: 'Leda',   name: 'Leda',   desc: '부드러운', gender: 'female' },
  { id: 'Charon', name: 'Charon', desc: '중후한',   gender: 'male'   },
  { id: 'Fenrir', name: 'Fenrir', desc: '강한',     gender: 'male'   },
  { id: 'Puck',   name: 'Puck',   desc: '밝은',     gender: 'male'   },
  { id: 'Orus',   name: 'Orus',   desc: '안정적',   gender: 'male'   },
];

export type ScriptScene = {
  text: string;
  displayText?: string; // 키네틱 모드: 화면 중앙 초대형 표시용 핵심 포인트
  imagePrompt: string;
  motionPrompt?: string;
  shouldAnimate?: boolean;
  textAnimationStyle?: 'none' | 'typewriter' | 'fly-in' | 'pop-in' | 'fade-zoom' | 'clock-spin' | 'pulse-ring' | 'sparkle' | 'confetti' | 'rain' | 'snow' | 'fire' | 'heart' | 'stars' | 'thunder' | 'chart-up' | 'film-roll' | 'magnifier' | 'lock-secure' | 'camera-flash';
  textPosition?: 'bottom' | 'center' | 'top';
};

export type SceneSplitResult = {
  scenes: ScriptScene[];
  usage: { promptTokens: number; completionTokens: number };
};

/**
 * Google AI Studio 직접 호출로 대본을 장면 분할
 */
export async function splitScriptIntoScenes(
  script: string,
  llmModelId = 'gemini-2.5-flash',
  sceneCount = 1,
  hasCharacter?: boolean,
  apiKey?: string,
  subCharacterNames?: string[],
  allowedAnimations?: string[],
  imageStyle?: string
): Promise<SceneSplitResult> {
  const isKineticMode = imageStyle === 'kinetic';
  // 키네틱 모드: 일반 모드와 동일 기준 (175자/씬) — displayText가 핵심 포인트 역할
  const adjustedSceneCount = sceneCount;
  
  const model = llmModelId.startsWith('google/') ? llmModelId.slice('google/'.length) : llmModelId;

  const subCharacterInstruction = subCharacterNames && subCharacterNames.length > 0
    ? `\n추가 캐릭터: ${subCharacterNames.map((n, i) => `캐릭터${i + 2}(${n})`).join(', ')}. 장면 내용에 따라 이 캐릭터들을 imagePrompt에 자연스럽게 등장시키세요.`
    : '';

  const characterInstruction = hasCharacter
    ? `\n**중요 - 메인 캐릭터 참조 이미지가 함께 전달됩니다**: 이미지 생성 시 참조 이미지의 캐릭터 외모(얼굴, 헤어스타일, 복장)를 반드시 유지하세요. imagePrompt에는 반드시 "same character as reference image,"를 앞에 붙이고, 장면에 맞는 표정(기쁨/슬픔/놀람/진지함 등), 자세(서있는/앉아있는/걷는/손짓하는 등), 배경, 조명을 구체적으로 묘사하세요.${subCharacterInstruction}`
    : '';

  const animList = (allowedAnimations && allowedAnimations.length > 0) 
    ? allowedAnimations.join(', ') 
    : 'none';

  const isTypographyMode = imageStyle === 'none';
  // isKineticMode is already declared above

  const kineticEffectsPrompt = `
(5) textAnimationStyle: **키네틱 타이포그래피 연출가로서, 각 장면의 감정·내용·에너지를 먼저 분석하고 가장 어울리는 효과를 선택하라.**

    선택 사고 순서:
    ① 이 장면의 핵심 감정은? (충격, 감동, 긴장, 유머, 희망, 분석, 결론 등)
    ② 그 감정을 시각적으로 가장 잘 살려주는 효과는?
    ③ 앞 장면과 다른 효과인가?

    [효과별 적합 상황]
    - 'typewriter'      한 글자씩 타자 치듯 등장 → 긴장감 고조, 충격 사실 폭로, 스토리 전환점, 숫자/통계 강조
    - 'fly-in'          아래서 슬라이드 진입      → 힘찬 등장, 새 챕터 시작, 역동적 주장
    - 'pop-in'          스프링 바운스 등장        → 놀라움, 반전, 유머, 경쾌한 포인트
    - 'fade-zoom'       서서히 줌인 등장          → 몽환적 회상, 평화로운 장면, 시적 여운
    - 'stagger-words'   단어가 시간차로 진입      → 리듬감 있는 나열, 강한 설득, 빠른 템포
    - 'kinetic-bounce'  단어들이 바운스하며 박힘  → 역동적 에너지, 키워드 강조, 통통 튀는 장면
    - 'focus-highlight' 단어가 순차 조명됨        → 논리 전개, 핵심 팩트 하나씩 전달
    - 'pulse-ring'      방사형 링 파동            → 강한 선언, 경고, 에너지 폭발
    - 'thunder'         번개 플래시               → 클라이맥스, 충격 반전, 가장 강한 한 방
    - 'fire'            불꽃 상승                 → 열정, 긴박감, 격렬한 감정의 정점
    - 'sparkle'         별빛 파티클               → 성취, 우아함, 신비로운 순간
    - 'confetti'        색종이 낙하               → 성공 마무리, 기쁨
    - 'heart'           하트 부유                 → 감동의 절정, 따뜻한 공감
    - 'rain'            빗방울 낙하               → 슬픔, 감성적 회상, 무게감
    - 'snow'            눈송이 부유               → 고요함, 평화, 기억
    - 'stars'           별 깜빡임                 → 꿈, 희망, 밤하늘, 소망
    - 'chart-up'        상승 차트                 → 성장 통계, 비즈니스 수치
    - 'clock-spin'      회전 시계                 → 시간 관련, 마감, 과거
    - 'magnifier'       돋보기 스캔               → 분석, 세부 발견, 집중
    - 'lock-secure'     자물쇠 잠금               → 결론 확정, 약속, 마무리 선언
    - 'camera-flash'    카메라 플래시             → 결정적 순간, 화제성, 진실 포착
    - 'film-roll'       필름 테두리               → 회상, 추억, 영화적 장면

    [원칙]
    - 연속 두 장면에 같은 스타일 금지
    - 전체 영상에서 동일 스타일 최대 1회
    - 'none' 사용 금지

(6) textPosition: 짧은 문장(50자 이하)은 'center', 긴 문장은 'bottom'`;

  const advancedEffectsPrompt = isKineticMode
    ? kineticEffectsPrompt
    : isTypographyMode
    ? `
(5) textAnimationStyle: 텍스트 애니메이션 및 모션 그래픽 (반드시 다음 목록 중에서만 선택: ${animList})
    - **중요: 타이포그래피 중심 영상이므로 모든 장면(100%)에 애니메이션/효과를 적용하세요.**
    - 'stagger-words': 순차 단어, 'kinetic-bounce': 팝업 강조, 'focus-highlight': 단어 조명, 'clock-spin': 시간/기다림, 'pulse-ring': 강한 강조, 'sparkle': 신비/우아함, 'confetti': 축하/승리, 'rain': 슬픔/감성, 'snow': 겨울/평화, 'fire': 열정/강렬, 'heart': 사랑/행복, 'stars': 꿈/밤하늘, 'thunder': 충격/파워, 'chart-up': 성장/비즈니스, 'film-roll': 추억/기록, 'magnifier': 분석/발견, 'lock-secure': 보안/약속, 'camera-flash': 화제/강조
(6) textPosition: 반드시 'bottom'으로 고정`
    : `
(5) textAnimationStyle: 텍스트 애니메이션 및 모션 그래픽 (반드시 다음 목록 중에서만 선택: ${animList})
    - **중요: 전체 장면의 40~60%에 반드시 애니메이션을 적용하세요. 'none'만 사용하는 것은 금지입니다.**
    - 장면 분위기에 맞게 선택: 'stagger-words'(단어 리듬감), 'kinetic-bounce'(바운스 강조), 'focus-highlight'(핵심 집중), 'clock-spin'(시간/기다림), 'pulse-ring'(강한 강조), 'sparkle'(신비/우아함), 'confetti'(축하/승리), 'rain'(슬픔/감성), 'snow'(겨울/평화), 'fire'(열정/강렬), 'heart'(사랑/행복), 'stars'(꿈/밤하늘), 'thunder'(충격/파워), 'chart-up'(성장/비즈니스), 'film-roll'(추억/기록), 'magnifier'(분석/발견), 'lock-secure'(보안/약속), 'camera-flash'(화제/강조), 'typewriter'(정보 전달), 'fly-in'(역동적 등장), 'pop-in'(경쾌한 강조), 'fade-zoom'(부드러운 전환)
    - 나머지 장면만 'none'으로 유지하세요.
(6) textPosition: 반드시 'bottom'으로 고정`;

  const imagePromptInstruction = isKineticMode
    ? `반드시 빈 문자열("")로 설정하세요. 키네틱 모드는 배경 이미지를 생성하지 않습니다.`
    : isTypographyMode
    ? `주로 **추상적이고 미니멀한 단색 또는 심플한 텍스처 배경**을 묘사하세요.`
    : `장면의 내용을 생생하게 묘사하는 구체적인 이미지 생성 프롬프트를 작성하세요.`;

  const response = await getAI(apiKey).models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `당신은 영상 제작 전문가입니다. 입력된 대본을 정확히 ${sceneCount}개의 장면으로 나누어주세요.

**[절대 규칙 — 위반 시 전체 작업 실패]**
1. **대본 전체 사용 의무**: 입력된 대본의 첫 글자부터 마지막 글자까지 한 글자도 빠짐없이 ${adjustedSceneCount}개의 text 필드에 분배해야 합니다. 요약, 생략, 재작성 절대 금지. 원문 그대로 잘라서 넣으세요.
2. **엄격한 분량 준수 (절대 위반 금지)**:
   - 전체 대본 ${script.length}자 ÷ ${adjustedSceneCount}장면 = 장면당 평균 **${Math.round(script.length / adjustedSceneCount)}자**
   - 각 장면은 **${isKineticMode ? '70자 이상 100자 이하' : '150자 이상 200자 이하'}**여야 합니다
   - **출력 전 각 장면의 글자 수를 직접 세어 검증하고, 범위를 벗어나면 반드시 재조정하세요**
3. **문장 단위 분할**: 문장 중간에서 자르지 말고 마침표(. ! ?)나 줄바꿈 기준으로 분할하세요.
4. **JSON 구조 엄수**: 반드시 {"scenes": [...]} 형태의 유효한 JSON만 출력하세요.
5. **imagePrompt/motionPrompt**: 각각 영어로 250자 내외로 작성하세요.
6. **언어 규칙**: text 필드는 반드시 한국어 원문 그대로. 영어 키워드(AI, GDP 등)는 원문에 있는 경우만 유지.
7. **핵심 단어 마크업**: 대본 중 가장 강조해야 할 키워드(제품명, 핵심 동사 등) 단어 한두 개를 **별표 두 개**로 감싸주세요 (예: "**AI 기술**이 세상을 바꿉니다"). 장면당 최대 2개까지 적용.

필드:
(1) text: 대본 원문 (한국어 기본, 영어 키워드는 포인트로만)
(2) imagePrompt: 이미지 생성 프롬프트(영어, ${imagePromptInstruction})
(3) motionPrompt: 동작 묘사 프롬프트(영어) — **인물 신체 동작 + 환경/배경 동작을 함께 묘사**하세요. 예: "person swaying shoulders and nodding head while rain streaks down the window behind them, soft ambient light flickering". 인물 동작(팔·손·머리·몸통)과 환경 동작(비·바람·불꽃·흐르는 물·구름 등)을 모두 구체적으로 작성하세요. 배경 동작만 단독으로 쓰지 말고, 반드시 인물 동작도 포함하세요.
(4) shouldAnimate: AI 비디오 변환 여부 — **전체 장면 수의 20% 이하(소수점 내림)만 true**로 설정하세요. 예: 4장면→최대 0개(없음), 5장면→최대 1개, 10장면→최대 2개, 20장면→최대 4개. true 조건(가장 임팩트 있는 1~2개만): 영상의 핵심 클라이맥스 장면, 인물의 강렬한 감정 표현 장면. 나머지는 모두 false.
${isKineticMode ? `(5-kinetic) displayText: **화면 중앙 초대형 타이포그래피** — 두 가지 형식 중 장면 내용에 맞게 선택:

    [형식 A] 단일 슬로건 — 기본값, 대부분의 장면에 사용
    - 5~15자 이내의 임팩트 문구
    - 예: "당신의 시간을", "지금 시작하라", "AI가 바꾼다", "멈출 수 없다"
    - 서사, 감정, 질문, 주장 장면 → 형식A 사용

    [형식 B] 3단 레이아웃 — "상단라벨|핵심단어|하단설명" (파이프 구분)
    - **전체 장면의 최대 2~3개에만 사용** — 숫자/통계/핵심 개념이 명확히 있을 때만
    - 조건: 구체적 숫자(%, 배수, 순위, 금액), 고유명사 강조, 결론 확정 장면
    - 상단라벨: 2~6자, 핵심단어: 1~8자 (** ** 래핑 시 accent 색), 하단설명: 2~8자
    - 예: "연봉 상승|**30%**|3년 만에 달성", "실패율|**87%**|창업 1년 이내"
    - **연속된 두 장면에 형식B 사용 금지**

    - **절대 금지: 전체 장면에서 동일한 displayText 반복. 모든 장면의 displayText는 서로 달라야 함**
` : ''}${advancedEffectsPrompt.trim()}${characterInstruction}

반드시 아래 JSON 형태로만 응답하세요:
{"scenes": [
  {
    "text": "...",${isKineticMode ? '\n    "displayText": "...",' : ''}
    "imagePrompt": "...",
    "motionPrompt": "...",
    "shouldAnimate": false,
    "textAnimationStyle": "...",
    "textPosition": "..."
  }
]}

대본:
${script}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingBudget: 0 },  // thinking 비활성화 → 전체 예산을 JSON 출력에 사용
    },
  });

  const content = response.text;
  if (!content) throw new Error('Gemini 응답이 없습니다');

  let jsonStr = content.trim();

  // 잘못된 JSON 자동 복구: 제어문자 제거, 줄바꿈 정리
  jsonStr = jsonStr
    .replace(/```json\n?|```/g, '')                   // 마크다운 코드블록 제거
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // 제어문자 제거
    .replace(/,\s*([}\]])/g, '$1')                        // trailing comma 제거
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');           // 키 따옴표 누락 보정

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // 마지막 완성된 장면까지만 추출 시도
    const partial = jsonStr.match(/("scenes"\s*:\s*\[[\s\S]*)\s*\{[^}]*$/);
    if (partial) {
      try {
        parsed = JSON.parse(jsonStr.slice(0, jsonStr.lastIndexOf('},') + 1) + ']}');
      } catch {
        throw new Error('Gemini JSON 파싱 실패 — 출력이 잘렸습니다. 다시 시도하거나 대본 길이를 줄여주세요.');
      }
    } else {
      throw new Error('Gemini JSON 파싱 실패 — 출력이 잘렸습니다. 다시 시도하거나 대본 길이를 줄여주세요.');
    }
  }

  const rawScenes: ScriptScene[] = parsed.scenes ?? (Array.isArray(parsed) ? parsed : []);

  const MIN_CHARS = isKineticMode ? 70 : 150;
  const MAX_CHARS = isKineticMode ? 100 : 200;

  // 200자 초과 씬을 150~200자 사이 문장 경계에서 분할
  function splitLongScene(scene: ScriptScene): ScriptScene[] {
    if (scene.text.length <= MAX_CHARS) return [scene];
    const text = scene.text;
    const splitChars = /[.!?…]/;
    let splitAt = -1;
    // 150~200자 사이에서 첫 번째 문장 끝 탐색
    for (let i = MIN_CHARS; i <= Math.min(MAX_CHARS, text.length - 1); i++) {
      if (splitChars.test(text[i])) { splitAt = i + 1; break; }
    }
    // 문장 끝 없으면 같은 구간에서 공백 기준
    if (splitAt === -1) {
      for (let i = MIN_CHARS; i <= Math.min(MAX_CHARS, text.length - 1); i++) {
        if (text[i] === ' ') { splitAt = i + 1; break; }
      }
    }
    if (splitAt === -1 || splitAt >= text.length) return [scene];

    const first: ScriptScene = { ...scene, text: text.slice(0, splitAt).trim() };
    const rest: ScriptScene = { ...scene, text: text.slice(splitAt).trim() };
    return [first, ...splitLongScene(rest)];
  }

  // 150자 미만 씬을 앞 씬에 강제 병합 (LLM 지시 무시 방지)
  const expanded = rawScenes.flatMap(splitLongScene);
  const scenes: ScriptScene[] = [];
  for (const scene of expanded) {
    const last = scenes[scenes.length - 1];
    if (last && scene.text.length < MIN_CHARS) {
      last.text = last.text + ' ' + scene.text;
    } else {
      scenes.push({ ...scene });
    }
  }
  // 병합 후에도 마지막 씬이 너무 짧으면 그 앞 씬에 합침
  while (scenes.length > 1 && scenes[scenes.length - 1].text.length < MIN_CHARS) {
    const last = scenes.pop()!;
    scenes[scenes.length - 1].text = scenes[scenes.length - 1].text + ' ' + last.text;
  }

  // 키네틱 모드 후처리
  if (isKineticMode) {
    // 1) displayText 중복 제거
    const seen = new Set<string>();
    for (const scene of scenes) {
      const dt = scene.displayText?.trim();
      if (dt) {
        if (seen.has(dt)) {
          const m = scene.text.match(/^[^.!?]{1,25}[.!?]?/);
          scene.displayText = m ? m[0].trim() : scene.text.slice(0, 20).trim();
        } else {
          seen.add(dt);
        }
      }
    }

    // 2) 3단 레이아웃(|) 연속 사용 차단 + 전체 최대 3개 제한
    let pipeCount = 0;
    let prevWasPipe = false;
    for (const scene of scenes) {
      const dt = scene.displayText?.trim() ?? '';
      const isPipe = dt.split('|').length === 3;
      if (isPipe && (prevWasPipe || pipeCount >= 3)) {
        // 파이프 제거 → 핵심단어만 단일 슬로건으로
        const parts = dt.split('|');
        scene.displayText = parts[1].replace(/\*\*/g, '').trim();
        prevWasPipe = false;
      } else {
        pipeCount += isPipe ? 1 : 0;
        prevWasPipe = isPipe;
      }
    }
  }

  const meta = (response as any).usageMetadata ?? {};
  return {
    scenes,
    usage: {
      promptTokens: meta.promptTokenCount ?? 0,
      completionTokens: meta.candidatesTokenCount ?? 0,
    },
  };
}

type GenerateImageOptions = {
  stylePrompt?: string;
  characterBase64?: string;
  characterMimeType?: string;
  subCharacters?: { base64: string; name: string }[];
  format?: string;
};

const FORMAT_TO_ASPECT: Record<string, string> = {
  shorts: '9:16',
  landscape: '16:9',
  square: '1:1',
};

export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {},
  modelId = 'google/gemini-2.5-flash-image',
  apiKey?: string
): Promise<string> {
  const { stylePrompt = '', characterBase64, characterMimeType = 'image/jpeg', subCharacters = [], format = 'landscape' } = options;
  const aspectRatio = FORMAT_TO_ASPECT[format] ?? '16:9';
  const fullPrompt = [prompt, stylePrompt].filter(Boolean).join(', ');
  const model = modelId.startsWith('google/') ? modelId.slice('google/'.length) : modelId;

  const parts: any[] = [];
  
  if (characterBase64) {
    parts.push({ inlineData: { mimeType: characterMimeType, data: characterBase64 } });
    parts.push({ text: `CHARACTER 1 (Main Character) REFERENCE:` });
  }
  
  subCharacters.forEach((sc, i) => {
    if (sc.base64) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: sc.base64 } });
      parts.push({ text: `CHARACTER ${i + 2} (${sc.name}) REFERENCE:` });
    }
  });

  if (parts.length > 0) {
    parts.push({ text: `\nIMPORTANT: Use these provided character reference images. You must preserve their exact appearances (face, hairstyle, clothing style) in the generated image whenever they appear in the scene description. Generate a new scene with these characters:\n\nSCENE DESCRIPTION: ${fullPrompt}\n\nKeep the characters visually consistent with their references.` });
  } else {
    parts.push({ text: fullPrompt });
  }

  const imageGenPromise = getAI(apiKey).models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: { responseModalities: ['IMAGE', 'TEXT'], generationConfig: { aspectRatio } } as any,
  });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini 이미지 생성 타임아웃 (90초 초과)')), 90000)
  );
  const response = await Promise.race([imageGenPromise, timeoutPromise]);

  const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart?.inlineData?.data) {
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') throw new Error('안전 필터에 의해 이미지 생성이 차단되었습니다. 프롬프트를 수정해주세요.');
    if (finishReason) throw new Error(`이미지 생성 실패 (차단 사유: ${finishReason})`);
    throw new Error('이미지 생성 실패: 모델이 이미지를 반환하지 않았습니다.');
  }

  const mimeType = imagePart.inlineData.mimeType ?? 'image/png';
  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';
  const key = `images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: imageBuffer, ContentType: mimeType,
  }));

  return `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
}

export async function generateSpeechBuffer(
  text: string,
  voiceName = 'Kore',
  apiKey?: string
): Promise<{ buffer: Buffer; durationMs: number }> {
  const response = await getAI(apiKey).models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.includes('audio'));
  if (!audioPart?.inlineData?.data) throw new Error('TTS 생성 실패');

  const pcmData = Buffer.from(audioPart.inlineData.data, 'base64');
  const buffer = pcmToWav(pcmData, 24000, 1, 16);
  const durationMs = Math.round((pcmData.length / (24000 * 2)) * 1000);
  return { buffer, durationMs };
}

function resamplePcm(pcm: Buffer, speed: number): Buffer {
  if (speed === 1.0) return pcm;
  const samples = pcm.length / 2;
  const newSamples = Math.round(samples / speed);
  const out = Buffer.alloc(newSamples * 2);
  for (let i = 0; i < newSamples; i++) {
    const srcIdx = Math.min(Math.floor(i * speed), samples - 1);
    out.writeInt16LE(pcm.readInt16LE(srcIdx * 2), i * 2);
  }
  return out;
}

export async function generateSpeech(text: string, filename: string, voiceName = 'Kore', speed = 1.0, apiKey?: string): Promise<{ url: string; durationMs: number }> {
  const response = await getAI(apiKey).models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ role: 'user', parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.includes('audio'));
  if (!audioPart?.inlineData?.data) throw new Error('TTS 생성 실패');

  const rawPcm = Buffer.from(audioPart.inlineData.data, 'base64');
  const pcmData = resamplePcm(rawPcm, Math.min(2.0, Math.max(0.5, speed)));
  const wavBuffer = pcmToWav(pcmData, 24000, 1, 16);
  const durationMs = Math.round((pcmData.length / (24000 * 2)) * 1000);

  const key = `audio/${filename}.wav`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: wavBuffer, ContentType: 'audio/wav',
  }));

  const url = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  return { url, durationMs };
}

export type SlideSceneData = {
  text: string;
  title: string;
  bullets?: string[];
  layout: 'title' | 'bullets' | 'quote';
};
export type SlideSplitResult = {
  slides: SlideSceneData[];
  usage: { promptTokens: number; completionTokens: number };
};

export async function splitScriptIntoSlides(
  script: string,
  llmModelId = 'gemini-2.5-flash',
  sceneCount = 1,
  apiKey?: string
): Promise<SlideSplitResult> {
  const model = llmModelId.startsWith('google/') ? llmModelId.slice('google/'.length) : llmModelId;

  const response = await getAI(apiKey).models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `당신은 PPT 슬라이드 전문가입니다. 입력된 대본을 정확히 ${sceneCount}개의 슬라이드로 나누어주세요.

**[절대 규칙]**
1. **대본 전체 사용 의무**: 입력된 대본의 첫 글자부터 마지막 글자까지 한 글자도 빠짐없이 ${sceneCount}개의 text 필드에 분배해야 합니다. 요약, 생략, 재작성 절대 금지.
2. **엄격한 분량 준수 (절대 위반 금지)**:
   - 전체 대본 ${script.length}자 ÷ ${sceneCount}슬라이드 = 슬라이드당 평균 **${Math.round(script.length / sceneCount)}자**
   - 각 슬라이드는 **150자 이상 200자 이하**여야 합니다
   - 짧은 문장·전환 문구 등 150자 미만이 되는 내용은 절대 별도 슬라이드로 만들지 말고, 앞 또는 뒤 슬라이드에 합치세요
   - **출력 전 각 슬라이드의 글자 수를 직접 세어 검증하고, 150자 미만이면 반드시 재조정하세요**
3. **JSON만 출력**: 반드시 {"slides": [...]} 형태의 유효한 JSON만 출력하세요.

필드:
- text: 대본 원문 (이 슬라이드에서 나레이션될 텍스트, 원문 그대로)
- title: 슬라이드 제목 (15자 이내, 핵심 키워드)
- layout: 슬라이드 레이아웃
  - "title": 챕터 제목/강조 키워드 슬라이드 (제목만 크게)
  - "bullets": 본문/정보 슬라이드 (제목 + 불릿 포인트)
  - "quote": 인용/핵심 문장 슬라이드 (큰 인용부호와 함께)
  - "comparison": 제품/기능/장단점 비교 슬라이드 (좌우 대구 방식)
- bullets: layout이 "bullets"인 경우만, 2~4개의 핵심 포인트 (각 30자 이내)
- comparisonData: layout이 "comparison"인 경우만 필수.
  - leftTitle: 좌측 박스 제목 (예: "장점", "A 제품")
  - rightTitle: 우측 박스 제목 (예: "단점", "B 제품")
  - leftItems: 좌측 항목 리스트 (문자열 배열, 각 25자 이내)
  - rightItems: 우측 항목 리스트 (문자열 배열, 각 25자 이내)

반드시 아래 JSON 형태로만 응답하세요:
{"slides": [
  {
    "text": "...",
    "title": "...",
    "layout": "...",
    "bullets": ["...", "..."],
    "comparisonData": {
      "leftTitle": "...",
      "rightTitle": "...",
      "leftItems": ["...", "..."],
      "rightItems": ["...", "..."]
    }
  }
]}

대본:
${script}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const content = response.text;
  if (!content) throw new Error('Gemini 응답이 없습니다');

  let jsonStr = content.trim()
    .replace(/```json\n?|```/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('슬라이드 JSON 파싱 실패. 다시 시도해주세요.');
  }

  const slides: SlideSceneData[] = parsed.slides ?? (Array.isArray(parsed) ? parsed : []);
  const metaUsage = (response as any).usageMetadata ?? {};
  return {
    slides,
    usage: {
      promptTokens: metaUsage.promptTokenCount ?? 0,
      completionTokens: metaUsage.candidatesTokenCount ?? 0,
    },
  };
}

function pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const dataSize = pcmData.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, 44);
  return buffer;
}
