const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
const sb = createClient(url, key);

async function main() {
    // Get the latest done job with video_url
    const { data: jobs } = await sb
        .from('video_jobs')
        .select('id, title_text, video_url, duration_seconds')
        .eq('status', 'done')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3);

    if (!jobs || jobs.length === 0) {
        console.log('No completed jobs found');
        return;
    }

    for (const job of jobs) {
        console.log(`\nJob: ${job.title_text} (${job.id.substring(0, 8)}...)`);
        console.log(`Duration: ${job.duration_seconds}s`);
        console.log(`URL: ${job.video_url?.substring(0, 80)}...`);

        // Check file size via HEAD request
        try {
            const res = await fetch(job.video_url, { method: 'HEAD' });
            const size = res.headers.get('content-length');
            const type = res.headers.get('content-type');
            console.log(`Status: ${res.status}`);
            console.log(`Size: ${size ? (parseInt(size) / 1024 / 1024).toFixed(1) + ' MB' : 'unknown'}`);
            console.log(`Type: ${type}`);
        } catch (e) {
            console.log('Fetch error:', e.message);
        }
    }
}

main();
