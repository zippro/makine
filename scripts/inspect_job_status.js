
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumn() {
    console.log('Checking for progress column...');
    const { data, error } = await supabase
        .from('video_jobs')
        .select('id, status, progress, assets')
        .eq('id', '1e02ed76-12c4-4018-97e2-53f7ceddb53c')
        .single();

    if (error) {
        console.error('Error fetching progress:', error);
    } else {
        console.log('Job Assets:', JSON.stringify(data.assets, null, 2));
    }
}

checkColumn();
