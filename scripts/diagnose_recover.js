const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 1. Service Role Client (Admin)
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 2. Public Client (User Simulation)
// We need a logged-in user to see RLS protected data properly, but for now let's see what anon sees or if we can sign in.
// We'll rely on Admin check for Schema first.

async function check() {
    console.log('--- Checking Schema (Admin) ---');
    // We can't query information_schema easily, but we can insert/select the new columns.

    // Check Video Jobs Assets
    const { data: jobs, error: jobError } = await supabaseAdmin.from('video_jobs').select('id, status, assets').limit(1);
    if (jobError) console.error('Error fetching jobs:', jobError.message);
    else {
        console.log('Video Jobs Columns Access:', jobs ? 'OK' : 'Failed');
        if (jobs && jobs.length > 0) {
            console.log('Sample Job Assets:', jobs[0].assets); // undefined if column missing?
            // If column is missing, Supabase usually ignores it in select unless explicit?
            // Actually, if I select 'assets' and it doesn't exist, it throws an error.
        }
    }

    // Check Projects YouTube Creds
    const { data: projects, error: projError } = await supabaseAdmin.from('projects').select('id, youtube_creds').limit(1);
    if (projError) console.error('Error fetching projects:', projError.message);
    else {
        console.log('Projects Columns Access:', projects ? 'OK' : 'Failed');
        if (projects && projects.length > 0) {
            console.log('Sample Project Creds:', projects[0].youtube_creds);
        }
    }

    console.log('\n--- Checking Stuck Jobs ---');
    const { data: stuck } = await supabaseAdmin.from('video_jobs').select('*').eq('status', 'processing');
    console.log(`Found ${stuck?.length || 0} stuck jobs.`);
    if (stuck?.length > 0) {
        console.log('Resetting stuck jobs to "queued"...');
        const ids = stuck.map(j => j.id);
        await supabaseAdmin.from('video_jobs').update({ status: 'queued' }).in('id', ids);
        console.log('Reset complete.');
    }
}

check();
