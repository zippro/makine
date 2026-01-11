const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function recoverProjects() {
    const oldUserId = '83c0aaca-f265-4a1c-913c-ff927a323167';
    const newUserId = '1f6411aa-e807-4500-95cd-f575bb04b79c'; // Current ID for zippro@gmail.com

    console.log(`Transferring projects from ${oldUserId} to ${newUserId}...`);

    const { data, error } = await supabase
        .from('projects')
        .update({ user_id: newUserId })
        .eq('user_id', oldUserId)
        .select();

    if (error) {
        console.error('Error migrating projects:', error.message);
    } else {
        console.log(`SUCCESS: Migrated ${data.length} projects.`);
        data.forEach(p => console.log(` - ${p.name} (${p.id})`));
    }
}

recoverProjects();
