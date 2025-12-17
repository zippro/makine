const fetch = require('node-fetch');

const AUDIO_URL = 'https://lcysphtjcrhgopjrmjca.supabase.co/storage/v1/object/public/audio/1765799839469-5jq9z.mp3';

async function checkAudio() {
    try {
        const res = await fetch(AUDIO_URL, { method: 'HEAD' });
        console.log(`Status: ${res.status} ${res.statusText}`);
        console.log(`Content-Type: ${res.headers.get('content-type')}`);
        console.log(`Content-Length: ${res.headers.get('content-length')}`);
    } catch (e) {
        console.error('Fetch Error:', e.message);
    }
}

checkAudio();
