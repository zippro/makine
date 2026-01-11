const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lcysphtjcrhgopjrmjca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteTestUser() {
    const email = 'verify-auth-test-user@example.com';

    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error("List users error:", listError);
        process.exit(1);
    }

    const existing = listData.users.find(u => u.email === email);
    if (existing) {
        const { error: delError } = await supabase.auth.admin.deleteUser(existing.id);
        if (delError) {
            console.error('Error deleting test user:', delError);
            process.exit(1);
        }
        console.log('Deleted test user:', email);
    } else {
        console.log('Test user not found (already deleted?)');
    }
}

deleteTestUser();
