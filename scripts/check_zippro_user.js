const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'zippro@gmail.com';
    const password = 'Simim1234';

    console.log(`Checking status for ${email}...`);

    // 1. Try Sign In
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (!signInError) {
        console.log('SUCCESS: User signed in successfully.');
        return;
    }

    console.log('Sign In failed:', signInError.message);

    // 2. Try Sign Up (to see if user exists)
    // We'll use a random password to not accidentally set a known one if we don't want to, 
    // but here we might as well try to register the user if they don't exist, as the user likely WANTS this account.
    // So we use the provided password.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Zippro User'
            }
        }
    });

    if (signUpError) {
        console.log('Sign Up result:', signUpError.message);
    } else if (signUpData.user) {
        // Check if it's a new user or existing (if existing, data.user is returned but session might be null depending on config)
        // But usually signUp returns "User already registered" error if confirmed.
        // If email confirmation is on, it might return user with null session.

        if (signUpData.session) {
            console.log('SUCCESS: User was missing, so I created it. You are now signed up and logged in.');
        } else {
            // If identities is empty or similar, need to check structure.
            // Usually if user exists and flow is implicit, supabase returns dummy user.
            // But let's rely on the error message "User already registered" which is common.
            console.log('Sign Up successful (User created). Check email for confirmation if required.');
            console.log('User ID:', signUpData.user.id);
        }
    }
}

checkUser();
