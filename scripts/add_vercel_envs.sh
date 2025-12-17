#!/bin/bash

# Function to add env var
add_var() {
  local key=$1
  local val=$2
  local env=$3
  echo "Adding $key to $env..."
  # Try to remove first to avoid prompt (ignore error)
  npx vercel env rm "$key" "$env" -y >/dev/null 2>&1
  # Add
  printf "%s" "$val" | npx vercel env add "$key" "$env"
}

# Read .env.hetzner.temp
while IFS='=' read -r key value; do
  if [[ -z "$key" || "$key" == \#* ]]; then continue; fi
  
  # Trim value
  value=$(echo "$value" | xargs)
  
  # Add to all envs
  add_var "$key" "$value" "production"
  add_var "$key" "$value" "preview"
  add_var "$key" "$value" "development"
  
done < .env.hetzner.temp
