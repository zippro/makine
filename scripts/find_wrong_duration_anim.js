
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findAnimation() {
    const jobId = 'ba745c28-3de7-4bd8-b085-3f19e5032eac';
    const { data: job } = await supabase.from('video_jobs').select('assets').eq('id', jobId).single();

    if (job && job.assets && job.assets.length > 0) {
        // The first asset is the one the user complained about (Koala/Puppy)
        const firstAsset = job.assets[0];
        console.log('First Asset:', firstAsset);

        // If it has animation_id, fetch that
        if (firstAsset.id) { // Assuming asset object might have an ID link? Or we check by URL?
            // Usually assets in job are just objects.
            // But if they came from animations table, we might be able to find it by URL.

            const { data: anims } = await supabase.from('animations')
                .select('*')
                .eq('url', firstAsset.url)
                .limit(1);

            if (anims && anims.length > 0) {
                console.log('Found Animation Record:', anims[0]);
            } else {
                console.log('No animation record found with that URL.');
            }
        }
    }
}
findAnimation();
