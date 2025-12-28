const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');


// const fetch = require('node-fetch'); // Use native fetch


// Config
const SUPABASE_URL = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM'; // Service Role
// const HETZNER_UPLOAD_URL = 'https://46.62.209.244.nip.io/upload';
const SERVER_IP = process.env.NEXT_PUBLIC_SERVER_IP || '46.62.209.244';
const HETZNER_UPLOAD_URL = `https://${SERVER_IP}.nip.io/upload`;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const downloadFile = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download: ${res.statusCode}`));
            }
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
};

const uploadToHetzner = async (buffer, filename, type) => {
    const form = new FormData();
    const blob = new Blob([buffer]);
    form.append('file', blob, filename);
    form.append('type', type);

    const res = await fetch(HETZNER_UPLOAD_URL, {
        method: 'POST',
        // headers: form.getHeaders(), // Native fetch sets headers automatically
        body: form
    });


    if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText} - ${await res.text()}`);
    }

    const data = await res.json();
    return data.url;
};

const migrateTable = async (tableName, type) => {
    console.log(`\n--- Migrating ${tableName} ---`);

    // Determine column name
    let urlCol = 'url';
    if (tableName === 'video_jobs') urlCol = 'video_url';

    const { data: items, error } = await supabase
        .from(tableName)
        .select(`id, ${urlCol}, created_at`)
        .ilike(urlCol, '%supabase%');

    if (error) {
        console.error(`Error fetching ${tableName}:`, error);
        return;
    }

    console.log(`Found ${items.length} items to migrate.`);

    for (const item of items) {
        const itemUrl = item[urlCol];
        if (!itemUrl) continue;

        // Generate filename if needed (or extract)
        const filename = path.basename(new URL(itemUrl).pathname);
        console.log(`Processing ${item.id} (${filename})...`);

        try {
            // 1. Download
            // ... (keep download logic)
            // 2. Upload
            // ... (keep upload logic)

            // NOTE: Reuse existing file check? 
            // For now, simple download/upload.

            console.log(`  Downloading from ${itemUrl}...`);
            const buffer = await downloadFile(itemUrl);

            console.log(`  Uploading to Hetzner...`);
            const newUrl = await uploadToHetzner(buffer, filename, type);
            console.log(`  New URL: ${newUrl}`);

            // 3. Update DB
            console.log(`  Updating DB...`);
            const updatePayload = {};
            updatePayload[urlCol] = newUrl;

            const { error: updateError } = await supabase
                .from(tableName)
                .update(updatePayload)
                .eq('id', item.id);

            if (updateError) throw updateError;
            console.log(`  ✅ Success!`);

        } catch (e) {
            console.error(`  ❌ Failed: ${e.message}`);
        }
    }
};

const run = async () => {
    try {
        await migrateTable('music_library', 'music');
        await migrateTable('images', 'images');
        await migrateTable('video_jobs', 'videos'); // Migrate output videos
        await migrateTable('animations', 'videos');  // Migrate animation records (often linked to same file)

        console.log('\nMigration Complete! 🚀');
    } catch (e) {
        console.error('Migration failed:', e);
    }
};

run();
