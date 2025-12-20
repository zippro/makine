// scripts/check_auth_users.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
    console.log('--- Checking Auth Users ---');

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log(`Total Users: ${users.length}`);

    const devUser = users.find(u => u.email === 'dev@example.com');

    if (devUser) {
        console.log('✅ User "dev@example.com" FOUND.');
        console.log('User ID:', devUser.id);

        // Update password to ensure it matches hardcoded credentials
        const { error: updateError } = await supabase.auth.admin.updateUserById(devUser.id, { password: 'password123' });
        if (!updateError) console.log('✅ Password reset to "password123"');
    } else {
        console.log('❌ User "dev@example.com" NOT FOUND.');
    }

    users.forEach(u => console.log(`- ${u.email} (${u.id})`));
}

checkUsers();
