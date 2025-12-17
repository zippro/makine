const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing provided key...');
    const { data, error } = await supabase.from('music_library').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Key is INVALID:', error.message);
    } else {
        console.log('Key is VALID!');
    }
}

testConnection();
