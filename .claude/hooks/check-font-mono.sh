#!/bin/bash
# PreToolUse hook — font-mono 규칙 강제
# 규칙: text-[10px] 이하에서 font-mono 절대 사용 금지 (Inter 기본 폰트 사용)

INPUT=$(cat)

# JSON에서 편집 내용 추출 (python3 우선, 없으면 원본 JSON 스캔)
if command -v python3 &>/dev/null; then
  CONTENT=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    ti = data.get('tool_input', {})
    print(ti.get('new_string', '') or ti.get('content', ''))
except:
    print('')
" 2>/dev/null)
else
  # python3 없는 환경: 원본 JSON 전체에서 스캔
  CONTENT="$INPUT"
fi

# 줄 단위 검사: font-mono + 작은 텍스트 크기가 같은 줄에 있으면 위반
VIOLATION=0
while IFS= read -r line; do
  if echo "$line" | grep -qE 'font-mono'; then
    if echo "$line" | grep -qE 'text-\[(5|6|7|8|9|10)px\]'; then
      VIOLATION=1
      break
    fi
  fi
done <<< "$CONTENT"

if [ "$VIOLATION" -eq 1 ]; then
  echo "❌ [font-mono 규칙 위반] text-[10px] 이하에서 font-mono 사용 금지!" >&2
  echo "   → font-mono를 제거하고 기본 Inter 폰트를 사용하세요" >&2
  echo "   → 예: text-[11px] text-white/40  (font-mono 없음)" >&2
  exit 2
fi

exit 0
