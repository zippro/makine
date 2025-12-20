const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log('Checking schema...');

    // Check video_jobs for 'assets'
    const { data: jobs, error: jobError } = await supabase
        .from('video_jobs')
        .select('assets')
        .limit(1);

    if (jobError) {
        if (jobError.message.includes('does not exist')) {
            console.log('❌ Column "assets" does NOT exist in video_jobs');
        } else {
            console.log('❓ Error checking video_jobs:', jobError.message);
        }
    } else {
        console.log('✅ Column "assets" exists in video_jobs');
    }

    // Check projects for 'youtube_creds'
    const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('youtube_creds')
        .limit(1);

    if (projError) {
        if (projError.message.includes('does not exist')) {
            console.log('❌ Column "youtube_creds" does NOT exist in projects');
        } else {
            console.log('❓ Error checking projects:', projError.message);
        }
    } else {
        console.log('✅ Column "youtube_creds" exists in projects');
    }
}

checkSchema();
