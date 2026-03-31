const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function test() {
  const endpoints = [
    `https://api.minimaxi.chat/v1/t2a_v2?GroupId=${process.env.MINIMAX_GROUP_ID}`,
    `https://api.minimaxi.chat/v1/text_to_audio_v2?GroupId=${process.env.MINIMAX_GROUP_ID}`
  ];

  for (const url of endpoints) {
    console.log('Testing URL:', url);
    const body = {
      model: 'speech-01-hd',
      text: '테스트입니다',
      stream: false,
      voice_setting: { voice_id: 'Korean_SoothingLady', speed: 1.0, vol: 1.0, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3' },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Response Length:', text.length);
      console.log('Response (first 200):', text.slice(0, 200));
    } catch (err) {
      console.error('Error:', err);
    }
    console.log('---');
  }
}

test();
