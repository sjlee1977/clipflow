
const API_KEY = 'sk-api-mrbAEfnUIW-4kwkSYvJhqPOLlHR9RBCs4tllJSzqal_kglHDZZeeFRj4iBtITdvHuEC2UgI9amkGKgDBL_qRP_0LoofhuAHLTI8dCreAQSuYOkjKfSOgfGg';
const GROUP_ID = '1988534836880479194';

async function testAudioSave() {
  const url = `https://api.minimaxi.chat/v1/t2a_v2?GroupId=${GROUP_ID}`;
  const body = {
    model: 'speech-01-hd',
    text: '테스트입니다. 긴 문장으로 테스트해 보겠습니다. 하나 둘 셋.',
    stream: false,
    voice_setting: {
      voice_id: 'Korean_SoothingLady',
      speed: 1.0,
      vol: 1.0,
      pitch: 0,
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  console.log('Raw Text (first 500 chars):', rawText.slice(0, 500));
  
  const lines = rawText.split('\n');
  let fullAudioBase64 = '';
  
  for (const line of lines) {
    if (line.startsWith('data:')) {
      try {
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        const data = JSON.parse(jsonStr);
        const audio = data.data?.audio || data.audio;
        if (audio) fullAudioBase64 += audio;
      } catch (e) {
        // ignore incomplete JSON
      }
    } else if (line.trim().startsWith('{')) {
       // Maybe it's a single JSON object instead of data: lines
       try {
         const data = JSON.parse(line);
         const audio = data.data?.audio || data.audio;
         if (audio) fullAudioBase64 += audio;
       } catch (e) {}
    }
  }

  if (!fullAudioBase64) {
    console.error('No audio found in any line');
    return;
  }

  const buffer = Buffer.from(fullAudioBase64, 'base64');
  const fs = await import('fs');
  fs.writeFileSync('test_audio_debug.mp3', buffer);
  console.log('Saved test_audio_debug.mp3, size:', buffer.length);
  console.log('First 10 bytes:', buffer.slice(0, 10).toString('hex'));
}

testAudioSave();
