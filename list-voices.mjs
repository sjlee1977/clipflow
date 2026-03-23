
const API_KEY = 'sk-api-mrbAEfnUIW-4kwkSYvJhqPOLlHR9RBCs4tllJSzqal_kglHDZZeeFRj4iBtITdvHuEC2UgI9amkGKgDBL_qRP_0LoofhuAHLTI8dCreAQSuYOkjKfSOgfGg';
const GROUP_ID = '1988534836880479194';

async function listVoices() {
  const url = `https://api.minimaxi.chat/v1/t2a_v2/voices?GroupId=${GROUP_ID}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    }
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Voices:', JSON.stringify(data, null, 2));
}

listVoices();
