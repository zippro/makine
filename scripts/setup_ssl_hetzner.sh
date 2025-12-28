#!/bin/bash
set -e

SERVER_IP="46.62.209.244"
DOMAIN="${SERVER_IP}.nip.io"
EMAIL="dev@makine.ai" # Dummy email for LetsEncrypt registration

echo "🚀 Setting up SSL for $DOMAIN..."

# 1. Install Certbot
echo "📦 Installing Certbot..."
apt-get update
apt-get install -y certbot python3-certbot-nginx

# 2. Update Nginx Config with Domain
echo "⚙️  Configuring Nginx for $DOMAIN..."
cat > /etc/nginx/sites-available/default <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 0;
    proxy_read_timeout 36000s;
    proxy_connect_timeout 36000s;
    proxy_send_timeout 36000s;
    fastcgi_read_timeout 36000s;

    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location /videos/ {
        alias /var/www/videos/;
        autoindex off;
    }

    location /upload {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_read_timeout 36000s;
        proxy_connect_timeout 36000s;
        proxy_send_timeout 36000s;
    }
}
NGINX

# 3. Reload Nginx to apply server_name
systemctl reload nginx

# 4. Request Certificate
echo "🔒 Requesting Let's Encrypt Certificate..."
# --non-interactive: Don't ask questions
# --redirect: Force Redirect HTTP -> HTTPS
# --agree-tos: Agree to terms
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

echo "✅ SSL Enabled! Your videos are served at https://$DOMAIN/videos/"
