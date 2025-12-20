
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manual env parsing
try {
    const envConfig = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) process.env[key.trim()] = val.trim();
    });
} catch (e) {
    console.warn('Could not read .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestJob() {
    const { data: jobs, error } = await supabase
        .from('video_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching job:', error);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log('No jobs found.');
        return;
    }

    const job = jobs[0];
    console.log('Latest Job:', {
        id: job.id,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
        error: job.error_message,
        assets: JSON.stringify(job.assets, null, 2),
        music_ids: job.music_ids
    });
}

checkLatestJob();
