/**
 * DashScope (Alibaba Cloud) 이미지 생성 라이브러리
 * z-image-turbo: multimodal-generation 엔드포인트 사용
 */

const BASE = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

// 포맷별 이미지 사이즈
const FORMAT_TO_SIZE: Record<string, string> = {
  shorts: '720*1280',
  landscape: '1280*720',
  square: '1024*1024',
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateDashscopeImage(
  prompt: string,
  modelId: string,
  format = 'landscape',
  apiKey?: string,
  characterBase64?: string,
  subCharacters?: { name: string; base64?: string; imageBase64?: string }[]
): Promise<string> {
  // 'qwen/z-image-turbo' → 'z-image-turbo'
  const effectiveModel = modelId.startsWith('qwen/') ? modelId.slice(5) : modelId;
  const size = FORMAT_TO_SIZE[format] ?? '1280*720';

  // edit 계열 모델은 멀티모달 참조 이미지 지원 (qwen-image-2.0도 생성+편집 겸용)
  const supportsReferenceImages = effectiveModel.includes('edit') || effectiveModel === 'qwen-image-2.0';

  // content 배열 구성: 참조 이미지(있을 경우) + 프롬프트 텍스트
  const messageContent: Record<string, string>[] = [];

  if (supportsReferenceImages) {
    const hasCharacter = !!characterBase64;
    // base64 또는 imageBase64 필드 모두 지원
    const hasSub = Array.isArray(subCharacters) && subCharacters.some(s => s.base64 || s.imageBase64);

    if (hasCharacter) {
      const imageData = characterBase64!.startsWith('data:')
        ? characterBase64!
        : `data:image/jpeg;base64,${characterBase64}`;
      messageContent.push({ image: imageData });
    }

    if (hasSub) {
      subCharacters!.forEach((sub) => {
        const raw = sub.base64 || sub.imageBase64;
        if (raw) {
          const imageData = raw.startsWith('data:')
            ? raw
            : `data:image/jpeg;base64,${raw}`;
          messageContent.push({ image: imageData });
        }
      });
    }

    // 텍스트는 반드시 1개만 (qwen-image-edit 계열 제약)
    if (hasCharacter || hasSub) {
      messageContent.push({
        text: `IMPORTANT: Use the provided character reference image(s). Preserve their exact appearances (face, hairstyle, clothing style). SCENE DESCRIPTION: ${prompt}. Keep the characters visually consistent with their references.`,
      });
    } else {
      messageContent.push({ text: prompt });
    }
  } else {
    messageContent.push({ text: prompt });
  }

  const body = JSON.stringify({
    model: effectiveModel,
    input: {
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
    },
    parameters: {
      // prompt_extend: qwen-image-edit 계열은 미지원
      ...(effectiveModel.includes('edit') ? {} : { prompt_extend: false }),
      size,
    },
  });

  // 429 발생 시 최대 3회 재시도 (지수 백오프: 5s → 10s → 20s)
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (res.status === 429) {
      if (attempt < MAX_RETRIES) {
        const waitMs = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s
        console.warn(`[dashscope-image] 429 Rate Limit. Retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitMs);
        continue;
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        const code = errJson.code ?? '';
        const msg = errJson.message ?? '';
        if (code === 'Throttling.RateQuota' || res.status === 429) {
          errMsg = 'DashScope API 요청 한도 초과 (429). 잠시 후 다시 시도해 주세요.';
        } else if (code === 'InvalidApiKey' || res.status === 401) {
          errMsg = 'DashScope API 키가 유효하지 않습니다. 설정에서 키를 확인해 주세요.';
        } else if (code === 'InsufficientBalance') {
          errMsg = 'DashScope 계정 잔액이 부족합니다.';
        } else if (msg) {
          errMsg = `DashScope 오류 (${code}): ${msg}`;
        }
      } catch {
        // JSON 파싱 실패 시 원문 그대로
      }
      throw new Error(`DashScope 이미지 생성 실패 (${res.status}): ${errMsg}`);
    }

    const data = await res.json();

    // 응답에서 이미지 URL 추출
    const responseContent = data?.output?.choices?.[0]?.message?.content;
    if (Array.isArray(responseContent)) {
      for (const item of responseContent) {
        if (item?.image) return item.image as string;
        if (item?.image_url) return item.image_url as string;
      }
    }

    throw new Error(`DashScope 이미지 URL 없음: ${JSON.stringify(data)}`);
  }

  throw new Error('DashScope 이미지 생성 실패: 최대 재시도 횟수 초과');
}
