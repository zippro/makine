const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUserAndJob() {
    console.log('--- Checking User ---');
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) console.error('Error listing users:', error);
    else {
        const devUser = users.find(u => u.email === 'dev@example.com');
        if (devUser) {
            console.log(`User 'dev@example.com' exists. ID: ${devUser.id}`);
        } else {
            console.log("User 'dev@example.com' DOES NOT EXIST.");
        }

        // Check project owner
        const { data: projects } = await supabase.from('projects').select('user_id').limit(1);
        if (projects && projects.length > 0) {
            console.log(`Project Owner ID: ${projects[0].user_id}`);
            if (devUser && projects[0].user_id !== devUser.id) {
                console.warn("MISMATCH: Project is owned by different user!");
            }
        }
    }

    console.log('\n--- Checking Latest Job Status ---');
    const { data: jobs } = await supabase.from('video_jobs').select('*').order('created_at', { ascending: false }).limit(1);
    if (jobs && jobs.length > 0) {
        console.log(`Latest Job ID: ${jobs[0].id}`);
        console.log(`Status: ${jobs[0].status}`);
        console.log(`Created: ${jobs[0].created_at}`);
        if (jobs[0].status === 'processing') {
            console.log("⚠️ Job is stuck in processing!");
        }
    }
}

checkUserAndJob();
