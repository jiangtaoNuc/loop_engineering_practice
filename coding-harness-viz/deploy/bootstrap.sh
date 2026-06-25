#!/usr/bin/env bash
# If invoked via sh, re-exec under bash (script uses bash-specific syntax)
if [ -z "${BASH_VERSION:-}" ]; then
    exec bash "$0" "$@"
fi
set -euo pipefail

# bootstrap.sh — one-time ECS onboarding script for coding-harness-viz
# Run as root: sudo bash bootstrap.sh  (or: sh bootstrap.sh)
# Not called by CI; for manual ops onboarding only.

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
echo ">> Detected distro: $DISTRO_ID (family: $PKG_FAMILY, package manager: $PKG_MANAGER)"

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
    if [[ "$PKG_FAMILY" == "debian" ]]; then
        apt-get update && apt-get install -y nginx
    else
        "$PKG_MANAGER" install -y nginx
    fi
else
    echo ">> nginx already installed: $(nginx -v 2>&1)"
fi

# 5. Copy systemd unit
echo ">> Installing systemd unit ..."
cp "$SCRIPT_DIR/coding-harness-viz-bff.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# 6. Copy nginx config (example — adjust server_name as needed)
echo ">> Installing nginx config to $NGINX_CONF ..."
cp "$SCRIPT_DIR/nginx.conf.example" "$NGINX_CONF"
if [[ "$PKG_FAMILY" == "debian" ]]; then
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/coding-harness-viz
    # Remove default site if present to avoid port conflict
    rm -f /etc/nginx/sites-enabled/default
else
    # RHEL family keeps configs directly in conf.d
    systemctl enable --now nginx
fi
nginx -t && nginx -s reload

# 7. Optional SELinux / firewalld adjustments on RHEL family
if [[ "$PKG_FAMILY" == "rhel" ]]; then
    if command -v getenforce &>/dev/null && [[ "$(getenforce)" == "Enforcing" ]]; then
        echo ">> SELinux enforcing; allowing nginx to make network connections ..."
        setsebool -P httpd_can_network_connect 1
    fi

    if command -v firewall-cmd &>/dev/null && systemctl is-active --quiet firewalld; then
        echo ">> firewalld active; adding http service ..."
        firewall-cmd --permanent --add-service=http
        firewall-cmd --reload
    fi
fi

echo ""
echo "=== Bootstrap complete ==="
echo "Next steps:"
echo "  1. Configure GitHub repo secrets (ECS_SSH_HOST, ECS_SSH_USER, ECS_SSH_PORT, ECS_SSH_PRIVATE_KEY)"
echo "  2. Trigger the deploy workflow from GitHub Actions"
echo "  3. Verify: curl http://127.0.0.1:3300/api/health"
