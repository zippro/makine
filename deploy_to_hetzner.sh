#!/bin/bash

# Configuration
SERVER_IP=$1
if [ -z "$SERVER_IP" ]; then
    echo "Usage: ./deploy_to_hetzner.sh <SERVER_IP>"
    echo "Example: ./deploy_to_hetzner.sh 123.45.67.89"
    exit 1
fi

echo "🚀 Starting Deployment to Hetzner ($SERVER_IP)..."
echo "⚠️  You will be asked for the server password multiple times."

# 1. Prepare Remote Environment (Install Node, FFmpeg)
echo "📦 Installing Dependencies on Server..."
ssh root@$SERVER_IP <<EOF
    apt-get update
    apt-get install -y curl ffmpeg fonts-dejavu fonts-liberation fonts-freefont-ttf fonts-urw-base35 nginx
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    # Create directory for code
    mkdir -p /root/worker/scripts

    # Create directory for videos (public)
    mkdir -p /var/www/videos
    chown -R root:root /var/www/videos
    chmod -R 755 /var/www/videos

    # Configure Nginx (ONLY IF NOT CONFIGURED)
    if ! grep -q "ssl_certificate" /etc/nginx/sites-available/default; then
        echo "Configuring Nginx (First Run)..."
        cat > /etc/nginx/sites-available/default <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;

    server_name _;

    location / {
        try_files \\\$uri \\\$uri/ =404;
    }

    location /videos/ {
        alias /var/www/videos/;
        autoindex off;
    }
}
NGINX
        systemctl restart nginx
    else
        echo "Nginx already configured with SSL. Skipping config overwrite."
    fi
EOF

# 2. Upload Files (Worker Code + Config)
echo "Cc: Uploading codebase..."
# Create a temporary package.json for the worker if it doesn't exist perfectly isolated
# usage: we copy existing package.json.
scp package.json root@$SERVER_IP:/root/worker/
scp -r scripts/local_ffmpeg_worker.js root@$SERVER_IP:/root/worker/scripts/
scp .env.local root@$SERVER_IP:/root/worker/

# 3. Setup Service (Auto-Restart) & Start
echo "⚙️  Configuring 24/7 Service..."
ssh root@$SERVER_IP <<EOF
    cd /root/worker
    
    # Install dependencies
    npm install

    # Append Server IP to env
    echo "NEXT_PUBLIC_SERVER_IP=$SERVER_IP" >> .env.local

    # Create Systemd Service (The "Forever" daemon)
    cat > /etc/systemd/system/video-worker.service <<SERVICE
[Unit]
Description=Music Video FFmpeg Worker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/worker
ExecStart=/usr/bin/node scripts/local_ffmpeg_worker.js
Restart=always
RestartSec=10
EnvironmentFile=/root/worker/.env.local

[Install]
WantedBy=multi-user.target
SERVICE

    # Enable and Start
    systemctl daemon-reload
    systemctl enable video-worker
    systemctl restart video-worker

    echo "✅ Worker Status:"
    systemctl status video-worker --no-pager
EOF

echo "🎉 Deployment Complete!"
echo "Your worker is now running 24/7 on Hetzner."
