require('dotenv').config({ path: '.env.hetzner.temp' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing connection to:', supabaseUrl);
    // Try to fetch something simple. Ideally, list buckets or something admin-only.
    // Or just reading from music_library with service role should work regardless of RLS.
    const { data, error } = await supabase.from('music_library').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Connection failed:', error);
    } else {
        console.log('Connection successful!');
        console.log('Music Library Count:', data); // data is null for head:true usually, count is in count
    }
}

testConnection();
