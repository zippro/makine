
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function reset() {
    const id = 'ba745c28-3de7-4bd8-b085-3f19e5032eac'; // The job user just created
    console.log(`Resetting job ${id}...`);
    const { error } = await supabase.from('video_jobs')
        .update({ status: 'queued', progress: 0, error_message: null })
        .eq('id', id);

    if (error) console.error('Error:', error);
    else console.log('Done.');
}

reset();
