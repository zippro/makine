// scripts/diagnose_project_schema.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Use Service Role to bypass RLS
);

async function checkProjects() {
    console.log('--- Checking Projects Schema ---');

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching projects:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No projects found.');
        return;
    }

    const project = data[0];
    console.log('First Project Keys:', Object.keys(project));
    console.log('video_mode:', project.video_mode);
    console.log('template_assets:', project.template_assets ? 'Present' : 'Missing/Null');
    console.log('overlay_config:', project.overlay_config ? 'Present' : 'Missing/Null');

    console.log('\nFull Object (Truncated):');
    console.log(JSON.stringify(project, null, 2));
}

checkProjects();
