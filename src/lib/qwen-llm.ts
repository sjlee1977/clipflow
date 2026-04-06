import { ScriptScene, SceneSplitResult } from './google';

/**
 * DashScope Qwen (通义千问) LLM Library for Scene Splitting
 */

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
  const isKineticMode = imageStyle === 'kinetic';
  const isTypographyMode = imageStyle === 'none';

  const subCharacterInstruction = subCharacterNames.length > 0
    ? `\n추가 캐릭터: ${subCharacterNames.map((n, i) => `캐릭터${i + 2}(${n})`).join(', ')}. 장면 내용에 따라 이 캐릭터들을 imagePrompt에 자연스럽게 등장시키세요.`
    : '';

  const characterInstruction = hasCharacter
    ? `\n**중요 - 메인 캐릭터 참조 이미지가 함께 전달됩니다**: 이미지 생성 시 참조 이미지의 캐릭터 외모(얼굴, 헤어스타일, 복장)를 반드시 유지하세요. imagePrompt에는 반드시 "same character as reference image,"를 앞에 붙이고 구체적으로 묘사하세요.${subCharacterInstruction}`
    : '';

  const animList = (allowedAnimations && allowedAnimations.length > 0) ? allowedAnimations.join(', ') : 'none';

  const systemPrompt = `당신은 영상 제작 전문가입니다. 입력된 대본을 정확히 ${sceneCount}개의 장면으로 나누어 JSON으로 출력하세요.`;

  const userPrompt = `입력된 대본을 정확히 ${sceneCount}개의 장면으로 나누어주세요.

**[절대 규칙]**
1. **대본 전체 사용 의무**: 입력된 대본의 첫 글자부터 마지막 글자까지 한 글자도 빠짐없이 text 필드에 분배해야 합니다. 요약, 생략, 재작성 절대 금지. 원문 그대로 잘라서 넣으세요.
2. **JSON 구조 엄수**: 반드시 {"scenes": [...]} 형태의 유효한 JSON만 출력하세요.
3. **imagePrompt/motionPrompt**: 각각 영어로 250자 내외로 작성하세요.
${isKineticMode ? '4. **displayText**: 5~15자 이내의 임팩트 문구.' : ''}

**필드 지시사항**:
(1) text: 대본 원문 (한국어 기본)
(2) imagePrompt: 이미지 생성 프롬프트(영어, ${isKineticMode ? '빈 문자열 ""' : '장면의 내용을 생생하게 묘사'})
(3) motionPrompt: 동작 묘사 프롬프트(영어) — 인물 신체 동작 + 환경 동작을 함께 구체적으로 묘사하세요.
(4) shouldAnimate: 전체 장면의 20% 이하만 true로 설정.
(5) textAnimationStyle: 반드시 다음 중에서만 선택: ${animList}. 전체 장면의 40~60%에 적용하세요.

대본:
${script}`;

  const cleanApiKey = apiKey.trim();

  // 모델 ID 표준화 (버전 번호가 포함된 이름을 표준 API 명칭으로 변환)
  let effectiveModel = modelId;
  const lowerId = modelId.toLowerCase();
  if (lowerId.includes('plus')) effectiveModel = 'qwen-plus';
  else if (lowerId.includes('max')) effectiveModel = 'qwen-max';
  else if (lowerId.includes('flash') || lowerId.includes('turbo')) effectiveModel = 'qwen-turbo';
  else if (lowerId.includes('omni')) effectiveModel = 'qwen-omni-turbo';

  // 가장 호환성이 높은 국제 계정 전용 엔드포인트 (-intl) 사용
  const res = await fetch('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanApiKey}`,
      'X-DashScope-ApiKey': cleanApiKey, 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: effectiveModel,
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      },
      parameters: {
        result_format: 'message',
        temperature: 0.7
      }
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qwen 장면 분할 실패: ${err}`);
  }

  const data = await res.json();
  // Native API는 output 객체 안에 choices가 있음
  const content = data.output?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Qwen 응답이 비어있습니다. (${JSON.stringify(data)})`);

  // 마크다운 코드 블록 제거 및 JSON 추출
  let jsonStr = content.trim();
  if (jsonStr.includes('```')) {
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1];
  }
  
  const parsed = JSON.parse(jsonStr.trim());

  return {
    scenes: parsed.scenes,
    usage: {
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
    }
  };
}
