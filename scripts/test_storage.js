const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDownload() {
    const file = '1766262283288-hpvgyb.mp3';
    console.log(`Attempting authenticated download of ${file}...`);

    const { data, error } = await supabase
        .storage
        .from('audio')
        .download(file);

    if (error) {
        console.error('Download Failed:', error);
    } else {
        console.log('Download Successful!');
        console.log('Blob size:', data.size);
        console.log('Blob type:', data.type);
    }
}

testDownload();
