require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectJob() {
    const jobId = '2d94ef08-b897-460d-8bef-306444cb28ed';
    console.log(`Inspecting Job: ${jobId}`);

    const { data: job, error } = await supabase
        .from('video_jobs')
        .select(`
            *,
            projects ( name ),
            video_music ( order_index, music_library ( duration_seconds ) )
        `)
        .eq('id', jobId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Title: ${job.title_text}`);
    console.log(`Status: ${job.status}`);
    console.log(`Project ID: ${job.project_id}`);
    console.log(`Project Name: ${job.projects ? job.projects.name : 'NULL'}`);
    console.log(`Duration (DB): ${job.duration_seconds}`);
    console.log(`Video URL: ${job.video_url}`);

    console.log('\nMusic Tracks:');
    job.video_music.forEach(vm => {
        console.log(`- Index ${vm.order_index}: ${vm.music_library.duration_seconds}s`);
    });
}

inspectJob();
