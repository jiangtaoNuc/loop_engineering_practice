#!/usr/bin/env bash
set -euo pipefail

# bootstrap.sh — one-time ECS onboarding script for coding-harness-viz
# Compatible with CentOS 7 (glibc 2.17) — uses nvm + Node 16 + pnpm 8
# Run as root: sudo bash bootstrap.sh

DEPLOY_DIR="/srv/coding-harness-viz"
SERVICE_NAME="coding-harness-viz-bff"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Distro detection
if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
else
    echo "Unsupported distro: cannot read /etc/os-release"
    exit 1
fi

DISTRO_ID="${ID:-unknown}"
DISTRO_LIKE="${ID_LIKE:-}"

PKG_MANAGER=""
PKG_FAMILY=""
NGINX_CONF=""

is_family() {
    local family="$1"
    if [[ "$DISTRO_ID" == "$family" ]]; then
        return 0
    fi
    for id in $DISTRO_LIKE; do
        if [[ "$id" == "$family" ]]; then
            return 0
        fi
    done
    return 1
}

if is_family "debian"; then
    PKG_FAMILY="debian"
    PKG_MANAGER="apt-get"
    NGINX_CONF="/etc/nginx/sites-available/coding-harness-viz"
elif is_family "rhel" || is_family "fedora"; then
    PKG_FAMILY="rhel"
    if command -v dnf &>/dev/null; then
        PKG_MANAGER="dnf"
    elif command -v yum &>/dev/null; then
        PKG_MANAGER="yum"
    else
        echo "RHEL/Fedora family detected but neither dnf nor yum found"
        exit 1
    fi
    NGINX_CONF="/etc/nginx/conf.d/coding-harness-viz.conf"
else
    echo "Unsupported distro: $DISTRO_ID"
    exit 1
fi

# Helpers for glibc-based Node version fallback
glibc_version() {
    if command -v ldd &>/dev/null; then
        ldd --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+' | head -n1
    fi
}

version_ge() {
    local v1_major="${1%%.*}"
    local v1_minor="${1#*.}"
    local v2_major="${2%%.*}"
    local v2_minor="${2#*.}"
    [[ "$v1_major" -gt "$v2_major" ]] || { [[ "$v1_major" -eq "$v2_major" ]] && [[ "$v1_minor" -ge "$v2_minor" ]]; }
}

echo "=== coding-harness-viz bootstrap ==="

# 1. Create deploy directories
echo ">> Creating directories under $DEPLOY_DIR ..."
mkdir -p "$DEPLOY_DIR/web" "$DEPLOY_DIR/bff"

# 2. Install Node.js via NodeSource if not present
#    Node 20+ requires glibc >= 2.28; fall back to Node 16 on older RHEL-family distros.
NODE_MAJOR_VERSION="20"
if [[ "$PKG_FAMILY" == "rhel" ]]; then
    GLIBC_VERSION="$(glibc_version)"
    if [[ -n "$GLIBC_VERSION" ]] && ! version_ge "$GLIBC_VERSION" "2.28"; then
        NODE_MAJOR_VERSION="16"
        echo ">> glibc $GLIBC_VERSION detected (< 2.28); falling back to Node.js $NODE_MAJOR_VERSION"
    fi
fi

if ! command -v node &>/dev/null; then
    echo ">> Installing Node.js $NODE_MAJOR_VERSION ..."
    if [[ "$PKG_FAMILY" == "debian" ]]; then
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR_VERSION}.x" | bash -
        apt-get install -y nodejs
    else
        curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR_VERSION}.x" | bash -
        "$PKG_MANAGER" install -y nodejs
    fi
    source "$NVM_DIR/nvm.sh"
    nvm install 16
    nvm alias default 16
    nvm use default
    # Symlinks for systemd and other users
    ln -sf "$(which node)" /usr/local/bin/node
    ln -sf "$(which npm)" /usr/local/bin/npm
    ln -sf "$(which npx)" /usr/local/bin/npx
    echo ">> Node.js installed: $(node --version)"
else
    echo ">> Node.js already installed: $(node --version)"
fi

# Ensure nvm loaded
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# 3. Install pnpm 8 globally (pnpm 9 requires Node 18+)
if ! command -v pnpm &>/dev/null; then
    echo ">> Installing pnpm@8 ..."
    npm install -g pnpm@8
    ln -sf "$(which pnpm)" /usr/local/bin/pnpm
else
    echo ">> pnpm already installed: $(pnpm --version)"
fi

# 4. Install nginx if not present
if ! command -v nginx &>/dev/null; then
    echo ">> Installing nginx ..."
    if grep -q "CentOS" /etc/os-release 2>/dev/null; then
        yum install -y epel-release
        yum install -y nginx
    else
        apt-get update && apt-get install -y nginx
    fi
else
    echo ">> nginx already installed: $(nginx -v 2>&1)"
fi

# 5. Install Docker if not present (for BFF container)
if ! command -v docker &>/dev/null; then
    echo ">> Docker not found. Please install Docker first."
    exit 1
else
    echo ">> Docker already installed: $(docker --version)"
fi

# 6. Copy nginx config (CentOS uses conf.d/, not sites-available/)
NGINX_CONF="/etc/nginx/conf.d/coding-harness-viz.conf"
echo ">> Installing nginx config to $NGINX_CONF ..."
cp "$SCRIPT_DIR/nginx.conf.example" "$NGINX_CONF"
# Fix port if needed (default nginx.conf may conflict on port 80)
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
nginx -t && systemctl enable nginx && systemctl restart nginx

echo ""
echo "=== Bootstrap complete ==="
echo "  node:   $(node --version)"
echo "  pnpm:   $(pnpm --version)"
echo "  nginx:  $(nginx -v 2>&1)"
echo "  docker: $(docker --version)"
echo ""
echo "Next steps:"
echo "  1. Build BFF image: docker build -f Dockerfile.bff -t coding-harness-bff:latest ."
echo "  2. Run BFF: docker run -d --name coding-harness-bff --restart always -p 127.0.0.1:3300:3300 coding-harness-bff:latest"
echo "  3. Configure GitHub repo secrets and trigger deploy workflow"
echo "  4. Verify: curl http://127.0.0.1:9000/api/health"
