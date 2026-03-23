
const API_KEY = '***REMOVED***';
const GROUP_ID = '1988534836880479194';

async function getVoices() {
  const url = `https://api.minimax.io/v1/get_voice?GroupId=${GROUP_ID}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ voice_type: 'all' })
  });
  const data = await res.json();
  const voices = data.system_voice || [];
  const koreanVoices = voices.filter(v => v.voice_id.toLowerCase().includes('korean'));
  koreanVoices.forEach(v => {
    console.log(`VOICE_ID: ${v.voice_id} | NAME: ${v.voice_name}`);
  });
}

getVoices();
