#!/bin/bash
# deploy_youtube_worker.sh
# Deploys the YouTube upload worker to the Hetzner VPS
#
# Usage: bash deploy_youtube_worker.sh

set -e

IP="46.62.209.244"
USER="root"

echo "🚀 Deploying YouTube Upload Worker to $IP..."

# 1. Copy worker script
echo "📦 Copying worker script..."
scp scripts/youtube_upload_worker.js $USER@$IP:/root/youtube_upload_worker.js

# 2. Install dependencies on VPS
echo "📥 Installing dependencies..."
ssh $USER@$IP << 'REMOTE'
cd /root

# Install googleapis and supabase if not present
npm list googleapis 2>/dev/null || npm install googleapis@latest
npm list @supabase/supabase-js 2>/dev/null || npm install @supabase/supabase-js@latest
npm list express 2>/dev/null || npm install express
npm list cors 2>/dev/null || npm install cors

# 3. Create systemd service
cat > /etc/systemd/system/youtube-upload.service << 'EOF'
[Unit]
Description=YouTube Upload Worker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/bin/node /root/youtube_upload_worker.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 4. Reload and restart service
systemctl daemon-reload
systemctl enable youtube-upload
systemctl restart youtube-upload

echo "✅ YouTube Upload Worker service started"
systemctl status youtube-upload --no-pager -l

REMOTE

# 5. Add nginx proxy for /youtube-status/ and /youtube-upload
echo "🌐 Configuring nginx proxy..."
ssh $USER@$IP << 'REMOTE2'
# Check if youtube proxy already configured
if ! grep -q "youtube-upload" /etc/nginx/sites-available/default 2>/dev/null; then
    # Find the server block and add locations before the last }
    # We'll create a separate conf file
    cat > /etc/nginx/conf.d/youtube-upload.conf << 'NGINX'
# YouTube Upload Worker proxy
# Proxies /youtube-upload and /youtube-status/ to Node.js worker on port 3002

upstream youtube_worker {
    server 127.0.0.1:3002;
}
NGINX

    # Add location blocks to the main site config
    # We need to add before the closing } of the server block
    if grep -q "server_name" /etc/nginx/sites-available/default; then
        # Check if locations already exist
        if ! grep -q "youtube-status" /etc/nginx/sites-available/default; then
            sed -i '/^}/i \
    # YouTube Upload Worker\
    location /youtube-upload {\
        proxy_pass http://127.0.0.1:3002/youtube-upload;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_read_timeout 30;\
        proxy_send_timeout 30;\
    }\
\
    location /youtube-status/ {\
        proxy_pass http://127.0.0.1:3002/youtube-status/;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
    }' /etc/nginx/sites-available/default
        fi
    fi

    nginx -t && systemctl reload nginx
    echo "✅ Nginx configured"
else
    echo "ℹ️ Nginx already configured for youtube-upload"
fi
REMOTE2

echo ""
echo "✅ Deployment complete!"
echo "   Worker: http://$IP:3002/health"
echo "   Via Nginx: https://$IP.nip.io/youtube-status/test"
echo ""
echo "Test with: curl http://$IP:3002/health"
