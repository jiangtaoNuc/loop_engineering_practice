#!/usr/bin/env bash
set -euo pipefail

# bootstrap.sh — one-time ECS onboarding script for coding-harness-viz
# Run as root: sudo bash bootstrap.sh
# Not called by CI; for manual ops onboarding only.

DEPLOY_DIR="/srv/coding-harness-viz"
SERVICE_NAME="coding-harness-viz-bff"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== coding-harness-viz bootstrap ==="

# 1. Create deploy directories
echo ">> Creating directories under $DEPLOY_DIR ..."
mkdir -p "$DEPLOY_DIR/web" "$DEPLOY_DIR/bff"

# 2. Install Node.js 20 via NodeSource if not present
if ! command -v node &>/dev/null; then
    echo ">> Installing Node.js 20 ..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo ">> Node.js already installed: $(node --version)"
fi

# 3. Install pnpm globally if not present
if ! command -v pnpm &>/dev/null; then
    echo ">> Installing pnpm ..."
    npm install -g pnpm@9
else
    echo ">> pnpm already installed: $(pnpm --version)"
fi

# 4. Install nginx if not present
if ! command -v nginx &>/dev/null; then
    echo ">> Installing nginx ..."
    apt-get update && apt-get install -y nginx
else
    echo ">> nginx already installed: $(nginx -v 2>&1)"
fi

# 5. Copy systemd unit
echo ">> Installing systemd unit ..."
cp "$SCRIPT_DIR/coding-harness-viz-bff.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# 6. Copy nginx config (example — adjust server_name as needed)
NGINX_CONF="/etc/nginx/sites-available/coding-harness-viz"
echo ">> Installing nginx config to $NGINX_CONF ..."
cp "$SCRIPT_DIR/nginx.conf.example" "$NGIN_CONF"
ln -sf "$NGIN_CONF" /etc/nginx/sites-enabled/coding-harness-viz
# Remove default site if present to avoid port conflict
rm -f /etc/nginx/sites-enabled/default
nginx -t && nginx -s reload

echo ""
echo "=== Bootstrap complete ==="
echo "Next steps:"
echo "  1. Configure GitHub repo secrets (ECS_SSH_HOST, ECS_SSH_USER, ECS_SSH_PORT, ECS_SSH_PRIVATE_KEY)"
echo "  2. Trigger the deploy workflow from GitHub Actions"
echo "  3. Verify: curl http://127.0.0.1:3300/api/health"
