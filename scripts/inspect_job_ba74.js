
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const jobId = 'ba745c28-3de7-4bd8-b085-3f19e5032eac';
    const { data, error } = await supabase.from('video_jobs').select('assets, loop_count').eq('id', jobId).single();
    if (error) console.error(error);
    else if (data) {
        console.log('Global Loop Count:', data.loop_count);
        if (Array.isArray(data.assets)) {
            console.log(JSON.stringify(data.assets.slice(0, 3), null, 2));
        } else {
            console.log("Assets is not an array:", data.assets);
        }
    } else {
        console.log("No data found for ID");
    }
}
check();
