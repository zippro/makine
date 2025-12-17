require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixJobData() {
    const jobId = 'fc74c228-ba7c-45b7-8669-9ba7e4a1cdb0';

    // 1. Fetch
    const { data: job, error: fetchError } = await supabase
        .from('video_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

    if (fetchError || !job) {
        console.error('Fetch Error:', fetchError);
        return;
    }

    // 2. Parse and Fix URL
    let newUrl = job.video_url;
    if (typeof job.video_url === 'string' && job.video_url.startsWith('{')) {
        try {
            const parsed = JSON.parse(job.video_url);
            if (parsed.storage_url) {
                newUrl = parsed.storage_url;
                console.log('Found valid storage_url:', newUrl);
            }
        } catch (e) {
            console.log('Error parsing JSON:', e);
        }
    } else if (typeof job.video_url === 'object' && job.video_url.storage_url) {
        // In case Supabase client auto-parsed it
        newUrl = job.video_url.storage_url;
    }

    if (newUrl !== job.video_url) {
        // 3. Update
        const { error: updateError } = await supabase
            .from('video_jobs')
            .update({ video_url: newUrl })
            .eq('id', jobId);

        if (updateError) console.error('Update Error:', updateError);
        else console.log('Successfully fixed video URL for this job.');
    } else {
        console.log('URL was already correct or could not be fixed.');
    }
}

fixJobData();
