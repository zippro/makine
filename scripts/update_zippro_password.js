const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role to update user without old password
const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePassword() {
    const email = 'zippro@gmail.com';
    const newPassword = 'Sinemim1234';

    console.log(`Updating password for ${email}...`);

    // Get User ID first (optional, but good for verification)
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        console.error('User not found!');
        return;
    }

    // Use updateUserById which is the standard admin method
    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
    );

    if (error) {
        console.error('Error updating password:', error.message);
    } else {
        console.log('SUCCESS: Password updated to Sinemim1234');
    }
}

updatePassword();
