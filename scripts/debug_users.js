const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUsers() {
    const email = 'zippro@gmail.com';

    console.log(`Listing all users matching ${email}...`);

    // listUsers usually returns pages, we'll get first 50
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error:', error);
        return;
    }

    const matches = users.filter(u => u.email === email);
    console.log(`Found ${matches.length} matches.`);

    matches.forEach(u => {
        console.log(` - ID: ${u.id} | Email: ${u.email} | Created: ${u.created_at} | Last Sign In: ${u.last_sign_in_at}`);
    });
}

debugUsers();
