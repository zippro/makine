const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Simulate Frontend Client (Public Key)
const supabasePublic = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testPublicAccess() {
    console.log('--- Testing Public Access (Anon Key) ---');

    // 1. Try to login as dev user to simulate frontend flow
    console.log('Attempting sign in as dev@example.com...');
    const { data: { session }, error: loginError } = await supabasePublic.auth.signInWithPassword({
        email: 'dev@example.com',
        password: 'password123'
    });

    if (loginError) {
        console.error('Login Failed:', loginError.message);
        return;
    }
    console.log('Login Success. User ID:', session.user.id);

    // 2. Fetch Projects
    console.log('Fetching projects...');
    const { data: projects, error: projError } = await supabasePublic.from('projects').select('*');

    if (projError) {
        console.error('Fetch Failed:', projError.message);
    } else {
        console.log(`Fetched ${projects.length} projects.`);
        if (projects.length > 0) {
            console.log('Project 0:', projects[0].name);
        } else {
            console.warn('Projects list is empty! RLS might be blocking or ownership mismatch.');
        }
    }
}

testPublicAccess();
