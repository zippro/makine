const { execSync } = require("child_process");
const fs = require("fs");

const magicKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeXNwaHRqY3JoZ29wanJtamNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ2NjgxMCwiZXhwIjoyMDgxMDQyODEwfQ.qltTkMLZQ11sgUYUwk09xp2KOVgX2AdXTawDZSg_zJM";
const url = "https://lcysphtjcrhgopjrmjca.supabase.co/rest/v1/video_jobs";

const payload = {
    user_id: "83c0aaca-f265-4a1c-913c-ff927a323167",
    image_url: "https://v3b.fal.media/files/b/0a8653cd/SHVn6YV-qKCM9Npy6mfat_output.mp4",
    audio_url: "https://lcysphtjcrhgopjrmjca.supabase.co/storage/v1/object/public/audio/1765799839469-5jq9z.mp3",
    title_text: "Video Title",
    status: "queued",
    title_appear_at: 7,
    project_id: "982ae248-4d54-4819-b3da-686800081df5"
    // Omit animation_id just in case it causes FK issues? No, keep it.
};
// Add animation_id back
payload.animation_id = "c68d4e67-cbf6-446a-b715-8327ba0b37bf";

fs.writeFileSync("clone_payload.json", JSON.stringify(payload));

// -f to fail on HTTP error, -v for headers
var cmd = 'curl -f -v -X POST -H "apikey: ' + magicKey + '"';
cmd += ' -H "Authorization: Bearer ' + magicKey + '"';
cmd += ' -H "Content-Type: application/json" -H "Prefer: return=representation"';
cmd += ' -d @clone_payload.json "' + url + '"';

console.log("Cloning job (Debug Mode)...");
try {
    const stdout = execSync(cmd);
    console.log("Output:", stdout.toString());
} catch (e) {
    console.error("Error Message:", e.message);
    if (e.stdout) console.error("Stdout (Error Body):", e.stdout.toString());
    if (e.stderr) console.error("Stderr (Curl Log):", e.stderr.toString());
}
