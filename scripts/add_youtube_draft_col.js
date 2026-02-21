const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

async function addColumn() {
    // Use the Supabase SQL endpoint (pg-meta)
    const pgUrl = url.replace('.supabase.co', '.supabase.co') + '/rest/v1/';

    // Method 1: Try using the query endpoint
    const sql = 'ALTER TABLE public.video_jobs ADD COLUMN IF NOT EXISTS youtube_draft JSONB DEFAULT NULL;';

    try {
        // Use the pg-meta API (available at /pg/)
        const res = await fetch(url + '/pg/query', {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': 'Bearer ' + key,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: sql })
        });

        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text.substring(0, 300));

        if (res.ok) {
            console.log('SUCCESS: youtube_draft column added!');
        } else {
            console.log('Method 1 failed, trying verification...');
            // Verify by trying to select the column
            const verifyRes = await fetch(url + '/rest/v1/video_jobs?select=youtube_draft&limit=1', {
                headers: {
                    'apikey': key,
                    'Authorization': 'Bearer ' + key,
                }
            });
            const verifyText = await verifyRes.text();
            console.log('Verify status:', verifyRes.status);
            console.log('Verify response:', verifyText.substring(0, 200));
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

addColumn();
