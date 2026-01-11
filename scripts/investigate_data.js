const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateData() {
    const email = 'zippro@gmail.com';

    // 1. Get the NEW User ID
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        console.log('User zippro@gmail.com not found.');
        return;
    }

    console.log(`Current User ID for ${email}: ${user.id}`);

    // 2. Check for projects owned by this NEW ID
    const { data: currentProjects, error: cpError } = await supabase
        .from('projects')
        .select('id, name, user_id')
        .eq('user_id', user.id);

    console.log(`Projects owned by CURRENT ID (${currentProjects?.length}):`);
    console.log(currentProjects);

    // 3. Check for ALL projects to see if we can find orphaned ones
    // We'll limit to 50 just to take a look. 
    // Ideally we'd filter by 'user_id' IS NOT IN (auth.users.id) but that's hard via JS client quickly.
    // Let's just list projects and their names.
    const { data: allProjects, error: apError } = await supabase
        .from('projects')
        .select('id, name, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    console.log('\n--- Recent Projects in DB ---');
    allProjects.forEach(p => {
        const isOwned = p.user_id === user.id;
        console.log(`[${isOwned ? 'OWNED' : 'OTHER'}] ID: ${p.id} | Name: ${p.name} | Owner: ${p.user_id}`);
    });

}

investigateData();
