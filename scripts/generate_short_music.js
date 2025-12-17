require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { execSync } = require('child_process');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// "Jazz Club Vibe" Project ID from previous context
const PROJECT_ID = '982ae248-4d54-4819-b3da-686800081df5';
const SOURCE_FILE = '1765750655189-5zjvz.mp3'; // The 5MB file

async function createShortTracks() {
    console.log('--- Creating 30s Test Tracks ---');

    try {
        // 1. Download Source
        console.log(`Downloading ${SOURCE_FILE}...`);
        const { data: blob, error: downError } = await supabase.storage
            .from('audio')
            .download(SOURCE_FILE);

        if (downError) throw downError;

        const buffer = Buffer.from(await blob.arrayBuffer());
        fs.writeFileSync('temp_source.mp3', buffer);

        // 2. Generate 2 short tracks using FFmpeg
        console.log('Trimming tracks...');

        // Track 1: 0-30s
        execSync('ffmpeg -y -i temp_source.mp3 -t 30 -c copy temp_short_1.mp3');

        // Track 2: 30-60s
        execSync('ffmpeg -y -i temp_source.mp3 -ss 30 -t 30 -c copy temp_short_2.mp3');

        // 3. Upload and Register
        const files = [
            { path: 'temp_short_1.mp3', name: 'Test Track A (30s).mp3', title: 'Test Track A (30s)' },
            { path: 'temp_short_2.mp3', name: 'Test Track B (30s).mp3', title: 'Test Track B (30s)' }
        ];

        // Fetch a user ID from the source record or just use the first user
        const { data: userData } = await supabase.auth.admin.listUsers();
        const userId = userData.users[0].id;

        for (const f of files) {
            const fileName = `${Date.now()}-${f.path}`;
            const fileContent = fs.readFileSync(f.path);

            console.log(`Uploading ${f.name}...`);
            const { error: upError } = await supabase.storage
                .from('audio')
                .upload(fileName, fileContent, { contentType: 'audio/mpeg' });

            if (upError) {
                console.error(`Upload failed for ${f.name}:`, upError);
                continue;
            }

            // Get Public URL
            const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName);

            console.log(`Registering ${f.name} in DB...`);
            const { error: dbError } = await supabase.from('music_library').insert({
                filename: f.name, // Use name as filename
                url: urlData.publicUrl,
                project_id: PROJECT_ID,
                user_id: userId
            });

            if (dbError) console.error('DB Insert Error:', dbError);
            else console.log(`Success: Added "${f.title}"`);
        }

        // Cleanup
        fs.unlinkSync('temp_source.mp3');
        fs.unlinkSync('temp_short_1.mp3');
        fs.unlinkSync('temp_short_2.mp3');
        console.log('Cleanup complete.');

    } catch (err) {
        console.error('Operation failed:', err);
    }
}

createShortTracks();
