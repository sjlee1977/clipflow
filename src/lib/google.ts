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
2. **엄격한 분량 준수 (150자 절대 상한)**:
   - 각 장면은 **100자 이상 150자 이하**여야 합니다. (문맥상 어쩔 수 없는 경우만 최소 90자 허용)
   - **절대 규칙**: 어떤 장면도 **150자를 초과해서는 안 됩니다.**
   - **문맥 위주 분할**: 단순히 글자 수로 자르지 말고, 마침표(.), 쉼표(,), 혹은 의미가 끊기는 지점에서 자연스럽게 나누세요.
   - **자가 검증**: 출력 전 각 장면의 글자 수를 직접 세어보고, 150자가 넘으면 반드시 더 잘게 나누세요.
3. **문장 단위 분할**: 문장 중간(단어 사이)에서 자르지 말고 의미 단위로 분할하세요.
4. **JSON 구조 엄수**: 반드시 {"scenes": [...]} 형태의 유효한 JSON만 출력하세요.
5. **imagePrompt/motionPrompt**: 각각 영어로 250자 내외로 작성하세요.
6. **언어 규칙**: text 필드는 반드시 한국어 원문 그대로. 영어 키워드(AI, GDP 등)는 원문에 있는 경우만 유지.
7. **원문 엄격 준수**: 대본 원문에 없는 마크다운 강조 표시(예: **단어**)를 절대로 임의로 추가하지 마세요. 대본 원문 그대로의 텍스트만 사용해야 합니다.

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

  const MIN_CHARS = 100;
  const MAX_CHARS = 150;

  // 150자 초과 씬을 문맥에 맞춰 재귀적으로 분할
  function splitLongScene(scene: ScriptScene): ScriptScene[] {
    if (scene.text.length <= MAX_CHARS) return [scene];
    const text = scene.text;
    const sentenceTerminators = /[.!?…\n]/;
    const clauseTerminators = /[,;:(—]/;
    
    let splitAt = -1;
    
    // 1) 150자 이내에서 가장 마지막 문장 종결자 찾기 (범위 제한 완화: 50~150)
    for (let i = MAX_CHARS - 1; i >= 50; i--) {
      if (sentenceTerminators.test(text[i])) { splitAt = i + 1; break; }
    }
    
    // 2) 없으면 150자 이내에서 마지막 쉼표/구분자 찾기
    if (splitAt === -1) {
      for (let i = MAX_CHARS - 1; i >= 50; i--) {
        if (clauseTerminators.test(text[i])) { splitAt = i + 1; break; }
      }
    }
    
    // 3) 없으면 150자 이내에서 마지막 공백 찾기
    if (splitAt === -1) {
      splitAt = text.lastIndexOf(' ', MAX_CHARS);
    }

    // 4) 최후의 수단: 150자 지점에서 무조건 절단
    if (splitAt <= 0) {
      splitAt = MAX_CHARS;
    }

    if (splitAt >= text.length) return [scene];

    const first: ScriptScene = { ...scene, text: text.slice(0, splitAt).trim() };
    const rest: ScriptScene = { ...scene, text: text.slice(splitAt).trim() };
    return [first, ...splitLongScene(rest)];
  }

  // 150자 미만 씬을 앞 씬에 강제 병합 (LLM 지시 무시 방지)
  const expanded = rawScenes.flatMap(splitLongScene);
  const scenes: ScriptScene[] = [];
  for (const scene of expanded) {
    const last = scenes[scenes.length - 1];
    if (last && (last.text.length + scene.text.length) <= MAX_CHARS && scene.text.length < MIN_CHARS) {
      last.text = last.text + ' ' + scene.text;
    } else {
      scenes.push({ ...scene });
    }
  }
  // 병합 후에도 마지막 씬이 너무 짧으면, 앞 씬과 합쳤을 때 150자가 안 넘는 경우만 합침
  while (scenes.length > 1 && 
         scenes[scenes.length - 1].text.length < MIN_CHARS && 
         (scenes[scenes.length - 1].text.length + scenes[scenes.length - 2].text.length) <= MAX_CHARS) {
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
  layout: 'title' | 'bullets' | 'quote' | 'comparison' | 'bigword' | 'boxlist' | 'statcard' | 'timeline' | 'icongrid' | 'progress' | 'chatwindow' | 'dialogsplit';
  stats?: { value: string; label: string }[];
  comparisonData?: {
    leftTitle: string;
    rightTitle: string;
    leftItems: string[];
    rightItems: string[];
  };
  summary?: string;
  headerBadge?: { icon?: string; text: string };
  warningTag?: string;
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
            text: `당신은 영상 연출 전문가입니다. 대본을 깊이 분석하고 각 장면의 내용·감정·구조에 가장 어울리는 레이아웃을 선택해 ${sceneCount}개 슬라이드로 만드세요.

═══ STEP 1: 대본 전체 분석 (레이아웃 결정 전 필수) ═══
각 문단을 읽으며 아래 신호를 찾아라:

【수치 신호】→ "statcard"
  감지 패턴: %, 배, 억, 조, 만 명, 위, 개국, 달러, 원, +, ↑↓, 순위
  예) "매출이 300% 증가", "전 세계 1억 명", "3위 달성" → statcard
  stats 필드: 텍스트에서 수치 추출해 value/label 작성

【비교·대립 신호】→ "comparison"
  감지 패턴: vs, ~보다, 반면, 하지만 ~은 ~이고, 장점/단점, 전/후, Before/After, A와 B의 차이
  예) "기존 방식은 느리지만, AI는 빠르다" → comparison
  comparisonData: 좌우 2개 항목씩 추출

【순서·단계 신호】→ "progress" 또는 "timeline"
  progress 감지: 첫째/둘째/셋째, 1단계/2단계, Step, 과정, 절차, 방법, →(흐름)
  timeline 감지: 연도(20xx년), 월, 분기, 역사적 흐름, 로드맵
  예) "2020년→2022년→2024년" → timeline / "입력→분석→출력" → progress
  progress bullets: "이모지 단계명 · 서브텍스트" 형태 필수 (예: ["📝 대본 작성 · 내가 씀", "🤖 Claude Code · AI가 코드 짬"])
  summary 필드: 전체 흐름을 요약하는 한 줄 (예: "대본만 쓰면 영상이 나오는 구조")

【AI 대화·설명 신호】→ "dialogsplit"
  감지 패턴: AI/Claude/GPT가 말하는 내용, AI의 관점/시각, 대화 형태, "저는 ~합니다"
  예) "Claude는 이렇게 생각한다", "AI의 입장에서 보면" → dialogsplit
  bullets[0]: 화자 이름 (예: "Claude"), bullets[1]: 오른쪽 패널 제목 (예: "AI가 읽는 방식")
  summary: 오른쪽 패널 완료 메시지 (예: "코드 생성 시작...")

【AI·기술·자동화 프로세스 신호】→ "chatwindow"
  감지 패턴: AI가 ~한다(명령/지시), 프롬프트, 명령어, 자동화, ChatGPT, Claude, 코딩, 스크립트
  예) "AI에게 명령만 하면" → chatwindow (title에 실제 명령 문장)

【기능·특징 나열 신호】→ "icongrid"
  감지 패턴: ~기능, ~특징, ~장점 3가지 이상 나열, 이모지로 표현 가능한 항목들
  예) "빠르고, 안전하고, 저렴하다" → icongrid

【인용·명언 신호】→ "quote"
  감지 패턴: 큰따옴표(""), 누군가의 말, ~라고 했다, 유명 격언
  예) '"우리는 도구를 만든다" — 스티브 잡스' → quote (최대 2개)

【챕터 오프닝 신호】→ "title"
  감지 패턴: 대본의 맨 첫 문단, 완전히 새로운 섹션 도입
  ⚠️ 전체에서 딱 1개만! 선언적 문장이라도 다른 레이아웃 우선 사용

【핵심 키워드 강조 신호】→ "bigword"
  감지 패턴: 단 하나의 단어/숫자가 전체 메시지, "바로 ~이다", 강력한 선언
  예) "결론은 단 하나다. 속도." → bigword
  ⚠️ 전체에서 최대 1개만! 짧은 선언문이라도 boxlist/bullets 우선 사용

【규칙·주의·제약 신호】→ "boxlist" (headerBadge + warningTag 포함)
  감지 패턴: 규칙, 지켜야 할 것, 주의사항, 제약, 조건, "반드시", "절대"
  예) "반드시 지켜야 할 규칙" → boxlist
  headerBadge: {"icon": "🔒", "text": "꼭 지킬 규칙"} 형태
  warningTag: "어기면 ~" 형태의 경고 한 줄
  bullets: "항목 제목 | 서브텍스트" 형태 (예: "채널 스타일 | 색상·폰트 고정")

【일반 박스 목록 신호】→ "boxlist"
  감지 패턴: 여러 항목을 나열하되 다른 레이아웃에 해당 안 될 때
  bullets: "항목 제목 | 서브텍스트" 형태 사용 가능

【기타 목록】→ "bullets" (최대 30% 제한, 마지막 수단)

═══ STEP 2: 슬라이드 생성 규칙 ═══
1. 대본 전체를 한 글자도 빠짐없이 ${sceneCount}개 text에 분배 (요약/재작성 금지)
2. 각 슬라이드 100~150자 (절대 150자 초과 금지)
3. 같은 layout 연속 2개 금지
4. bullets 최대 30% 제한
5. title: 전체에서 딱 1개 (첫 슬라이드만) / bigword: 최대 1개 — 절대 초과 금지
6. 짧고 선언적인 문장도 boxlist, bullets, quote 등 내용 레이아웃으로 처리
7. JSON만 출력: {"slides": [...]}
6. 대본 원문에 없는 **강조** 마크다운 추가 금지

═══ STEP 3: 필드 작성 규칙 ═══
- text: 대본 원문 그대로 (100~150자)
- title: 슬라이드 제목 15자 이내
- layout: STEP 1 분석 결과
- bullets 필수 layout (bullets/boxlist/icongrid/progress/bigword):
    boxlist/bullets: 핵심 포인트 2~4개 (각 25자 이내)
    icongrid: ["🚀 항목명"] 형태 (이모지 필수)
    progress: ["1단계", "2단계", "3단계"] (2~5개)
    timeline: ["2020 · 내용"] 형태
    bigword: ["보조 설명 1줄"]
- stats (statcard 필수): [{"value":"300%","label":"매출 성장"}] 2~4개
- comparisonData (comparison 필수):
    {"leftTitle":"✓ 장점","rightTitle":"✗ 단점","leftItems":["..."],"rightItems":["..."]}
- summary (progress/dialogsplit 권장): 전체 요약 한 줄 문장
- headerBadge (boxlist 규칙/주의 시): {"icon":"🔒","text":"꼭 지킬 규칙"}
- warningTag (boxlist 규칙 시): "어기면 영상이 깨지거나 통일감 사라짐"

═══ 출력 예시 ═══
{"slides":[
  {"text":"...","title":"AI 에이전트 시대","layout":"title"},
  {"text":"...","title":"폭발적 성장","layout":"statcard","stats":[{"value":"300%","label":"시장 성장"},{"value":"1억 명","label":"사용자"}]},
  {"text":"...","title":"기존 vs AI","layout":"comparison","comparisonData":{"leftTitle":"기존 방식","rightTitle":"AI 방식","leftItems":["느린 처리","높은 비용"],"rightItems":["즉각 처리","비용 절감"]}},
  {"text":"...","title":"작동 원리","layout":"progress","bullets":["📝 대본 작성 · 내가 씀","🤖 AI 분석 · 자동화","🎬 영상 완성 · 20분 후"],"summary":"대본만 쓰면 영상이 나오는 구조"},
  {"text":"...","title":"핵심 기능","layout":"icongrid","bullets":["🚀 초고속","🔒 보안","💡 혁신","📊 분석"]},
  {"text":"...","title":"AI에게 맡겨라","layout":"chatwindow","bullets":["Claude Opus 4.6 · Agent"]},
  {"text":"...","title":"저는 글로 읽어요","layout":"dialogsplit","bullets":["Claude","AI가 읽는 방식"],"summary":"코드 생성 시작..."},
  {"text":"...","title":"꼭 지킬 규칙","layout":"boxlist","headerBadge":{"icon":"🔒","text":"꼭 지킬 규칙"},"bullets":["채널 스타일 | 색상·폰트 고정","Remotion 공식 | API 문법 준수"],"warningTag":"어기면 영상이 깨지거나 통일감 사라짐"}
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
      thinkingConfig: { thinkingBudget: 8000 },
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
  
  const MIN_CHARS = 100;
  const MAX_CHARS = 150;

  // 150자 초과 슬라이드를 문맥에 맞춰 재귀적으로 분할
  function splitLongSlide(slide: SlideSceneData): SlideSceneData[] {
    if (slide.text.length <= MAX_CHARS) return [slide];
    const text = slide.text;
    const sentenceTerminators = /[.!?…\n]/;
    const clauseTerminators = /[,;:(—]/;
    let splitAt = -1;
    
    // 150자 이내의 가장 늦은 종결자 찾기 (50~150자 범위)
    for (let i = MAX_CHARS - 1; i >= 50; i--) {
      if (sentenceTerminators.test(text[i])) { splitAt = i + 1; break; }
    }
    if (splitAt === -1) {
      for (let i = MAX_CHARS - 1; i >= 50; i--) {
        if (clauseTerminators.test(text[i])) { splitAt = i + 1; break; }
      }
    }
    if (splitAt === -1) {
      splitAt = text.lastIndexOf(' ', MAX_CHARS);
    }
    if (splitAt <= 0) {
      splitAt = MAX_CHARS;
    }
    if (splitAt >= text.length) return [slide];

    const first: SlideSceneData = { ...slide, text: text.slice(0, splitAt).trim() };
    const rest: SlideSceneData = { ...slide, text: text.slice(splitAt).trim() };
    return [first, ...splitLongSlide(rest)];
  }

  // 너무 짧은 슬라이드 병합
  const expanded = slides.flatMap(splitLongSlide);
  const finalSlides: SlideSceneData[] = [];
  for (const slide of expanded) {
    const last = finalSlides[finalSlides.length - 1];
    if (last && (last.text.length + slide.text.length) <= MAX_CHARS && slide.text.length < MIN_CHARS) {
      last.text = last.text + ' ' + slide.text;
    } else {
      finalSlides.push({ ...slide });
    }
  }
  // 마지막 슬라이드가 짧으면, 앞 슬라이드와 합쳤을 때 150자가 안 넘는 경우만 합침
  while (finalSlides.length > 1 && 
         finalSlides[finalSlides.length - 1].text.length < MIN_CHARS && 
         (finalSlides[finalSlides.length - 1].text.length + finalSlides[finalSlides.length - 2].text.length) <= MAX_CHARS) {
    const last = finalSlides.pop()!;
    finalSlides[finalSlides.length - 1].text = finalSlides[finalSlides.length - 1].text + ' ' + last.text;
  }

  // ── 레이아웃 다양성 후처리 ──────────────────────────────────────────────────
  // quote: 전체의 15% 이하, 최대 2개
  // title+bigword 합산: 전체의 30% 이하
  // ── 텍스트에서 bullets 자동 생성 ────────────────────────────────────────────
  function autoGenerateBullets(slide: SlideSceneData): string[] {
    if ((slide.bullets?.length ?? 0) > 0) return slide.bullets!;
    const sentences = slide.text.split(/[.!?。,，]\s+/).map(s => s.trim()).filter(s => s.length > 4);
    const bullets = sentences.slice(0, 3).map(s => s.slice(0, 25));
    return bullets.length > 0 ? bullets : [slide.title || slide.text.slice(0, 24)];
  }

  // ── 텍스트 신호 기반 레이아웃 감지 (프로그래밍 방식) ──────────────────────
  function detectLayoutFromText(slide: SlideSceneData, exclude: SlideSceneData['layout'][]): SlideSceneData['layout'] | null {
    const t = slide.text + ' ' + (slide.title ?? '');

    // 수치/통계 신호 → statcard
    if (!exclude.includes('statcard') && /[\d]+\s*(%|배|억|조|위|개국|만\s*명|달러|원|\+|↑|↓)/.test(t)) {
      return 'statcard';
    }
    // 비교/대립 신호 → comparison
    if (!exclude.includes('comparison') && !slide.comparisonData &&
      /(vs\.?|VS|보다|반면|하지만|장점.{0,15}단점|단점.{0,15}장점|전.{0,10}후|before.{0,10}after|차이|비교)/i.test(t)) {
      slide.comparisonData = {
        leftTitle: '기존', rightTitle: '변화',
        leftItems: autoGenerateBullets(slide).slice(0, 2),
        rightItems: autoGenerateBullets(slide).slice(0, 2),
      };
      return 'comparison';
    }
    // 단계/과정 신호 → progress
    if (!exclude.includes('progress') &&
      /(단계|첫째|둘째|셋째|step\s*\d|1단계|2단계|과정|절차|방법|순서)/i.test(t)) {
      slide.bullets = autoGenerateBullets(slide);
      return 'progress';
    }
    // 연도/히스토리 신호 → timeline
    if (!exclude.includes('timeline') &&
      /(20[0-9]{2}년|19[0-9]{2}년|[0-9]{4}년.{0,20}[0-9]{4}년|역사|출시|런칭|시작.{0,10}성장)/.test(t)) {
      slide.bullets = autoGenerateBullets(slide);
      return 'timeline';
    }
    // AI 대화/설명 신호 → dialogsplit
    if (!exclude.includes('dialogsplit') &&
      /(저는|제가|저를|우리는|우리가).{0,40}(AI|인공지능|Claude|GPT|모델)|(AI|Claude|GPT|모델).{0,30}(말|생각|관점|입장|방식|읽|처리|이해)/i.test(t)) {
      slide.bullets = slide.bullets?.length ? slide.bullets : ['Claude', 'AI가 읽는 방식'];
      return 'dialogsplit';
    }
    // AI/프롬프트/자동화 신호 → chatwindow
    if (!exclude.includes('chatwindow') &&
      /(AI가|AI는|프롬프트|명령어|자동화|ChatGPT|claude|gemini|코딩|스크립트|에이전트)/i.test(t)) {
      return 'chatwindow';
    }
    // 기능/특징 나열 신호 → icongrid
    if (!exclude.includes('icongrid') &&
      /(기능|특징|장점|지원|제공).{0,30}(기능|특징|장점|지원|제공)/.test(t)) {
      slide.bullets = autoGenerateBullets(slide);
      return 'icongrid';
    }
    // 목록 나열 → boxlist
    if (!exclude.includes('boxlist') && slide.text.length > 60) {
      slide.bullets = autoGenerateBullets(slide);
      return 'boxlist';
    }
    return null;
  }

  // fallback 레이아웃 선택 (다양성 보장) — bigword/title은 fallback에서 제거
  const DIVERSE_POOL: SlideSceneData['layout'][] = ['boxlist', 'icongrid', 'progress', 'timeline', 'bullets', 'quote'];
  function pickFallback(slide: SlideSceneData, exclude: SlideSceneData['layout'][]): SlideSceneData['layout'] {
    // 1. 텍스트 신호 감지 우선
    const detected = detectLayoutFromText(slide, exclude);
    if (detected) return detected;
    // 2. 다양성 풀에서 exclude 안 걸리는 첫 번째 선택
    for (const l of DIVERSE_POOL) {
      if (!exclude.includes(l)) {
        slide.bullets = autoGenerateBullets(slide);
        return l;
      }
    }
    return 'bigword';
  }

  // ── 다양성 강제 후처리 ────────────────────────────────────────────────────
  const quoteMax = Math.max(1, Math.min(2, Math.floor(finalSlides.length * 0.15)));
  // title: 최대 1개 (전체 첫 슬라이드만), bigword: 전체의 10% 이하 최대 1개
  const titleMax = 1;
  const bigwordMax = Math.max(0, Math.min(1, Math.floor(finalSlides.length * 0.10)));
  let quoteCount = 0;
  let titleCount = 0;
  let bigwordCount = 0;

  // 1차: title/bigword 레이아웃에 텍스트 신호 기반 재배정 (강제 대체)
  for (let i = 0; i < finalSlides.length; i++) {
    const slide = finalSlides[i];
    const prev = i > 0 ? finalSlides[i - 1].layout : null;
    // 첫 슬라이드가 아닌 title은 다른 레이아웃으로 강제 변환 시도
    if (i > 0 && slide.layout === 'title') {
      const detected = detectLayoutFromText(slide, ['title', 'bigword', prev ?? 'title']);
      if (detected) slide.layout = detected;
    }
    // bigword는 항상 대체 시도
    if (slide.layout === 'bigword') {
      const detected = detectLayoutFromText(slide, ['title', 'bigword', prev ?? 'bigword']);
      if (detected) slide.layout = detected;
    }
  }

  for (let i = 0; i < finalSlides.length; i++) {
    const slide = finalSlides[i];
    const prev = i > 0 ? finalSlides[i - 1].layout : null;

    // quote 초과 제한
    if (slide.layout === 'quote') {
      quoteCount++;
      if (quoteCount > quoteMax) {
        slide.layout = pickFallback(slide, ['quote', 'title', 'bigword', prev ?? 'quote']);
      }
    }

    // title: 최대 1개 (첫 슬라이드만)
    if (slide.layout === 'title') {
      titleCount++;
      if (titleCount > titleMax) {
        slide.layout = pickFallback(slide, ['title', 'bigword', prev ?? 'title']);
      }
    }

    // bigword: 최대 1개
    if (slide.layout === 'bigword') {
      bigwordCount++;
      if (bigwordCount > bigwordMax) {
        slide.layout = pickFallback(slide, ['title', 'bigword', prev ?? 'bigword']);
      }
    }

    // 연속 같은 layout 방지
    if (prev && slide.layout === prev) {
      slide.layout = pickFallback(slide, [slide.layout, 'title', 'bigword']);
    }
  }

  const metaUsage = (response as any).usageMetadata ?? {};
  return {
    slides: finalSlides,
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
