require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMusicSizes() {
    const files = [
        '1765750651122-kcdj1q.mp3',
        '1765750655189-5zjvz.mp3'
    ];

    console.log('--- Checking Music File Sizes ---');

    for (const file of files) {
        const { data, error } = await supabase.storage
            .from('audio')
            .list('', { search: file });

        if (error) {
            console.error(`Error checking ${file}:`, error);
        } else if (data && data.length > 0) {
            const sizeMB = (data[0].metadata.size / 1024 / 1024).toFixed(2);
            console.log(`File: ${file}`);
            console.log(`- Size: ${sizeMB} MB`);
            // Rough est @ 128kbps: 1MB ~= 1 minute
            console.log(`- Est. Duration: ~${Math.ceil(sizeMB)} minutes`);
        } else {
            console.log(`File ${file} not found in storage list.`);
        }
    }
}

checkMusicSizes();
