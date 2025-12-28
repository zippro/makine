
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data } = await supabase.from('video_jobs').select('id, status, created_at, updated_at').order('created_at', { ascending: false }).limit(5);
    console.log(data);
}
check();
