require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFile() {
    console.log('--- Checking File Metadata ---');
    const fileName = '1765750645206-hssswk.mp3';

    // List to see metadata
    const { data: listData, error: listError } = await supabase.storage
        .from('audio')
        .list('', { search: fileName });

    if (listError) {
        console.error('List Error:', listError);
    } else {
        console.log('List Result:', listData);
    }

    // Try downloading to check if it works internally
    const { data: downloadData, error: downloadError } = await supabase.storage
        .from('audio')
        .download(fileName);

    if (downloadError) {
        console.error('Download Error:', downloadError);
    } else {
        console.log('Download Success. Size:', downloadData.size);
    }
}

checkFile();
