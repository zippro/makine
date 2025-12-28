
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Hardcoded for this specific rescue mission
const JOB_ID = '830a869e-e2e0-4efe-b969-71ffd86d0383';
const FILE_PATH = './temp_output_830a.mp4';
const BUCKET = 'audio'; // As seen in worker script
const STORAGE_PATH = `videos/${JOB_ID}_output.mp4`;

async function repair() {
    console.log(`Starting manual repair for Job ${JOB_ID}`);

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Missing env vars. Ensure .env.local is loaded.');
        process.exit(1);
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (!fs.existsSync(FILE_PATH)) {
        console.error(`File not found: ${FILE_PATH}. Did you run SCP?`);
        process.exit(1);
    }

    const fileBuffer = fs.readFileSync(FILE_PATH);
    console.log(`Read file size: ${fileBuffer.length / 1024 / 1024} MB`);

    console.log('Uploading to Supabase...');
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(STORAGE_PATH, fileBuffer, {
            contentType: 'video/mp4',
            upsert: true
        });

    if (uploadError) {
        console.error('Upload Failed:', uploadError);
        process.exit(1);
    }

    console.log('Upload successful!');

    const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(STORAGE_PATH);

    const publicUrl = urlData.publicUrl;
    console.log('Public URL:', publicUrl);

    console.log('Updating Job Status in DB...');
    const { error: dbError } = await supabase
        .from('video_jobs')
        .update({
            status: 'done',
            progress: 100,
            video_url: publicUrl,
            error_message: null
        })
        .eq('id', JOB_ID);

    if (dbError) {
        console.error('DB Update Failed:', dbError);
        process.exit(1);
    }

    console.log('✅ Job successfully marked as DONE!');
}

repair();
