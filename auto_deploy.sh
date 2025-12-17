#!/bin/bash
IP="46.62.209.244"
PASS="j4sPVXqqsWCwje7hEpv7"

echo "🤖 Starting Fully Automated Deployment..."

# 1. Setup SSH Trust (Handle Password Change + Add Key)
chmod +x setup_hetzner_trust.exp
./setup_hetzner_trust.exp $IP $PASS

echo "✅ Trust Established. New Server Password: RendiWorker2025!"
echo "🚀 Running Main Installation..."

# 2. Run the main deployment (Now passwordless)
chmod +x deploy_to_hetzner.sh
./deploy_to_hetzner.sh $IP
