const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Using ANON key to simulate client
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAccess() {
    const email = 'zippro@gmail.com';
    const password = 'Sinemim1234';

    console.log(`1. Logging in as ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (authError) {
        console.error('Login Failed:', authError.message);
        return;
    }

    const userId = authData.user.id;
    console.log(`Login Successful. User ID: ${userId}`);

    console.log('2. Attempting to fetch projects as this user (EXACT QUERY)...');
    const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select("*, video_mode, template_assets, overlay_config")
        .order("created_at", { ascending: false });

    if (projectError) {
        console.error('Fetch Failed:', projectError.message);
    } else {
        console.log(`Fetch Successful. Found ${projects.length} projects.`);
    }

    console.log('3. Attempting to CREATE a project as this user...');
    const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert([{ name: 'ScriptTestProject', user_id: userId }])
        .select()
        .single();

    if (createError) {
        console.error('Create Failed:', createError.message);
    } else {
        console.log('Create Successful:', newProject.id);
    }
}

verifyAccess();
