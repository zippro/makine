
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data } = await supabase.from('video_jobs').select('id, status, error_message, updated_at').order('updated_at', { ascending: false }).limit(5);
    console.log(data);
}
check();
