
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const TARGET_PROJECT_ID = '982ae248-4d54-4819-b3da-686800081df5'; // Jazz Club Vibe (Correct ID)
const TARGET_USER_ID = '83c0aaca-f265-4a1c-913c-ff927a323167'; // Dev User

async function recoverImages() {
    // Debug: Check projects
    const { data: projects, error: projError } = await supabase.from('projects').select('id, name');
    console.log('Projects in DB:', projects);
    if (!projects.find(p => p.id === TARGET_PROJECT_ID)) {
        console.error('CRITICAL: Target Project ID not found in DB!');
        return;
    }

    console.log('Listing files in images bucket...');
    const { data: files, error } = await supabase.storage.from('images').list();

    if (error) {
        console.error('Error listing bucket:', error);
        return;
    }

    console.log(`Found ${files.length} files. Recovering...`);

    let recoveredCount = 0;
    for (const file of files) {
        if (file.name === '.emptyFolderPlaceholder') continue;

        // check if exists
        const { data: existing } = await supabase
            .from('images')
            .select('id')
            .eq('filename', file.name) // Check filename
            .eq('project_id', TARGET_PROJECT_ID)
            .single();

        if (existing) {
            console.log(`Skipping ${file.name} (already exists)`);
            continue;
        }

        const publicUrl = `${supabaseUrl}/storage/v1/object/public/images/${file.name}`;

        const { error: insertError } = await supabase
            .from('images')
            .insert({
                filename: file.name,
                url: publicUrl,
                project_id: TARGET_PROJECT_ID,
                user_id: TARGET_USER_ID
            });

        if (insertError) {
            console.error(`Failed to insert ${file.name}:`, insertError);
        } else {
            console.log(`Recovered ${file.name}`);
            recoveredCount++;
        }
    }
    console.log(`Recovery complete. Restored ${recoveredCount} images.`);
}

recoverImages();
