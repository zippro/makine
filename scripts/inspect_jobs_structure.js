
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('video_jobs').select('*').limit(1);
    if (error) console.error(error);
    else if (data && data.length > 0) {
        console.log('Keys:', Object.keys(data[0]));
        // Check finding loop count
        console.log('loop_count value:', data[0].loop_count);
    }
}
check();
