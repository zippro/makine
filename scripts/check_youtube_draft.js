const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

if (!key) {
    console.log('No SUPABASE_SERVICE_ROLE_KEY found in .env.local');
    process.exit(1);
}

const sb = createClient(url, key);

async function main() {
    // Test if youtube_draft column already exists
    const { data, error } = await sb
        .from('video_jobs')
        .select('youtube_draft')
        .limit(1);

    if (error && error.message.includes('youtube_draft')) {
        console.log('Column youtube_draft does NOT exist. Please add it via Supabase dashboard:');
        console.log('SQL: ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS youtube_draft JSONB DEFAULT NULL;');
    } else {
        console.log('Column youtube_draft already exists or query succeeded.');
        console.log('Data:', JSON.stringify(data));
    }
}

main().catch(console.error);
