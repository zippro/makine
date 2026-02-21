/**
 * Add source + generation_meta columns to images table
 * Run: node scripts/add_image_gen_columns.js
 */

const SUPABASE_URL = "https://lmkyzzplcxnswaqjrrwi.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get project ref from URL
const PROJECT_REF = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");

async function addColumns() {
    console.log("Adding source + generation_meta columns to images table...");
    console.log("Project ref:", PROJECT_REF);

    // Use the Supabase SQL endpoint to run ALTER TABLE
    const sql = `
        DO $$
        BEGIN
            -- Add source column if not exists
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'images' AND column_name = 'source'
            ) THEN
                ALTER TABLE images ADD COLUMN source text DEFAULT 'upload';
                RAISE NOTICE 'Added source column';
            ELSE
                RAISE NOTICE 'source column already exists';
            END IF;

            -- Add generation_meta column if not exists
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'images' AND column_name = 'generation_meta'
            ) THEN
                ALTER TABLE images ADD COLUMN generation_meta jsonb;
                RAISE NOTICE 'Added generation_meta column';
            ELSE
                RAISE NOTICE 'generation_meta column already exists';
            END IF;
        END $$;
    `;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
    });

    // Actually, let's use the direct SQL approach via management API
    const mgmtRes = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({ query: sql }),
        }
    );

    if (!mgmtRes.ok) {
        const errText = await mgmtRes.text();
        console.error("Management API error:", mgmtRes.status, errText);

        // Fallback: try direct REST approach
        console.log("\nTrying direct SQL via PostgREST rpc...");
        const directRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ sql }),
        });

        if (!directRes.ok) {
            console.error("Direct SQL also failed:", await directRes.text());
            console.log("\n⚠️ Please run this SQL manually in Supabase SQL Editor:");
            console.log(sql);
            return;
        }
    }

    const data = await mgmtRes.json();
    console.log("✅ Result:", JSON.stringify(data, null, 2));
}

addColumns().catch(console.error);
