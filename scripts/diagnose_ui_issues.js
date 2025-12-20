const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
    console.log('--- Diagnosing Projects ---');
    const { data: projects, error: projError } = await supabase.from('projects').select('*');
    if (projError) {
        console.error('❌ Failed to fetch projects:', projError.message);
    } else {
        console.log(`✅ Fetched ${projects.length} projects.`);
        if (projects.length > 0) {
            console.log('Sample Project:', JSON.stringify(projects[0], null, 2));
        }
    }

    console.log('\n--- Diagnosing Jobs (Thumbnails) ---');
    const { data: jobs, error: jobError } = await supabase
        .from('video_jobs')
        .select('id, title_text, image_url, thumbnail_url, video_url, status')
        .order('created_at', { ascending: false })
        .limit(5);

    if (jobError) {
        console.error('❌ Failed to fetch jobs:', jobError.message);
    } else {
        console.log(`✅ Fetched ${jobs.length} recent jobs.`);
        jobs.forEach((job, i) => {
            console.log(`\nJob ${i + 1}: ${job.title_text} (${job.status})`);
            console.log(` - Image URL: ${job.image_url}`);
            console.log(` - Thumb URL: ${job.thumbnail_url}`);
            console.log(` - Video URL: ${job.video_url}`);

            if (job.image_url) {
                const isVideo = job.image_url.toLowerCase().match(/\.(mp4|webm|mov)$/);
                console.log(` - Detected as Video? ${!!isVideo}`);
            }
        });
    }
}

diagnose();
