require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Use env key (now fixed)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkJobs() {
    console.log('--- Recent Video Jobs ---');
    const { data: jobs, error } = await supabase
        .from('video_jobs')
        .select('id, status, created_at, error_message, title_text')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching jobs:', error.message);
        return;
    }

    jobs.forEach(j => {
        console.log(`[${new Date(j.created_at).toLocaleTimeString()}] ID: ${j.id} | Status: ${j.status}`);
        if (j.error_message) console.log(`   ❌ Error: ${j.error_message}`);
    });
}

checkJobs();
