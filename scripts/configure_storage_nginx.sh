#!/bin/bash
set -e

SERVER_IP="46.62.209.244"
DOMAIN="${SERVER_IP}.nip.io"
EMAIL="dev@makine.ai"

echo "⚙️  Updating Nginx Config for Storage & Uploads..."

# Defines the new configuration with Upload Proxy and Static Paths
cat > /etc/nginx/sites-available/default <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root /var/www/html;
    index index.html index.htm;
    
    # Increase body size for uploads
    client_max_body_size 100M;

    location / {
        try_files \$uri \$uri/ =404;
    }

    # Video Worker Output
    location /videos/ {
        alias /var/www/videos/;
        autoindex off;
    }
    
    # Storage: Music
    location /music/ {
        alias /var/www/music/;
        autoindex off;
    }

    # Storage: Images
    location /images/ {
        alias /var/www/images/;
        autoindex off;
    }

    # Storage: Animations
    location /animations/ {
        alias /var/www/animations/;
        autoindex off;
    }

    # Upload API Proxy
    location /upload {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

# Reload to apply HTTP config first
systemctl reload nginx

echo "🔒 Re-applying SSL..."
# This re-reads the config we just wrote and adds the SSL directives back
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

echo "✅ Nginx Storage Configuration Complete!"
