require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const PROJECT_ID = '982ae248-4d54-4819-b3da-686800081df5';
const USER_ID = '83c0aaca-f265-4a1c-913c-ff927a323167'; // From previous diagnosis

async function recoverMusic() {
    console.log('--- Recovering Music from Audio Bucket ---');

    // 1. List files in 'audio' bucket
    const { data: files, error: listError } = await supabase.storage.from('audio').list();
    if (listError) {
        console.error('Error listing audio bucket:', listError);
        return;
    }

    console.log(`Found ${files.length} files in 'audio' bucket.`);

    // 2. Insert into music_library if not exists
    for (const file of files) {
        // Skip placeholders or folders if any
        if (file.name === '.emptyFolderPlaceholder') continue;

        // Check availability
        const { data: existing } = await supabase
            .from('music_library')
            .select('id')
            .eq('filename', file.name)
            .eq('project_id', PROJECT_ID)
            .maybeSingle();

        if (existing) {
            console.log(`Skipping ${file.name} (already exists)`);
            continue;
        }

        // Construct public URL
        const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(file.name);

        // Insert
        const { error: insertError } = await supabase
            .from('music_library')
            .insert({
                user_id: USER_ID,
                project_id: PROJECT_ID,
                filename: file.name,
                url: publicUrl,
                file_size: file.metadata?.size || null,
                duration_seconds: null // Unknown without processing
            });

        if (insertError) {
            console.error(`Failed to insert ${file.name}:`, insertError);
        } else {
            console.log(`Recovered: ${file.name}`);
        }
    }
}

recoverMusic();
