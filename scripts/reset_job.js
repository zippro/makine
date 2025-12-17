const { execSync } = require("child_process");
const fs = require("fs");

const magicKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM";
const url = "https://lcysphtjcrhgopjrmjca.supabase.co/rest/v1/video_jobs?id=eq.5fb46710-6bb3-4905-9c10-c7e18487d40c";

// ONLY update the valid column
const payload = {
    status: "queued"
};

fs.writeFileSync("final_payload.json", JSON.stringify(payload));

var cmd = 'curl -v -X PATCH -H "apikey: ' + magicKey + '"';
cmd += ' -H "Authorization: Bearer ' + magicKey + '"';
cmd += ' -H "Content-Type: application/json" -H "Prefer: return=representation"';
cmd += ' -d @final_payload.json "' + url + '"';

console.log("Resetting job to queued (Final Attempt)...");
try {
    const stdout = execSync(cmd);
    console.log("Output:", stdout.toString());
} catch (e) {
    console.error("Error:", e.message);
    if (e.stderr) console.error("Stderr:", e.stderr.toString());
}
