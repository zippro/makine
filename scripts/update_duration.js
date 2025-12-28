
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function update() {
    const id = '6c1fd4ed-9892-4da4-b51a-5d156d8f6852';
    console.log(`Updating animation ${id} duration to 25.2...`);
    const { error } = await supabase.from('animations')
        .update({ duration: 25.2 })
        .eq('id', id);

    if (error) console.error('Error:', error);
    else console.log('Done.');
}
update();
