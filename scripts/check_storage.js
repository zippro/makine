require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BUCKET = 'audio';
const FILE_PATH = '1765799839469-5jq9z.mp3';

async function checkStorage() {
    console.log(`Checking bucket: ${BUCKET}`);

    // Check bucket existence and public status
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
        console.error('Error listing buckets:', bucketError);
        return;
    }

    const audioBucket = buckets.find(b => b.name === BUCKET);
    if (!audioBucket) {
        console.error(`Bucket '${BUCKET}' NOT FOUND!`);
    } else {
        console.log(`Bucket '${BUCKET}' found. Public: ${audioBucket.public}`);
    }

    // Check file existence
    console.log(`Checking file: ${FILE_PATH}`);
    const { data: files, error: fileError } = await supabase.storage.from(BUCKET).list();
    if (fileError) {
        console.error('Error listing files:', fileError);
        return;
    }

    const file = files.find(f => f.name === FILE_PATH);
    if (file) {
        console.log('File FOUND:', file);
        // Get public URL
        const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(FILE_PATH);
        console.log('Generated Public URL:', publicUrl);
    } else {
        console.log('File NOT FOUND in root of bucket.');
        // Try to list specifically if it's in a folder (though path provided seems root)
    }
}

checkStorage();
