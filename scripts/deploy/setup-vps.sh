#!/usr/bin/env bash
# First-time VPS setup for cutline-industries self-hosted deployment
# Run once as root on a fresh Ubuntu 22.04 or Debian 12 server.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/lpittman-g/Cutline-Industries/main/scripts/deploy/setup-vps.sh | bash
#   # OR copy to server and run: bash setup-vps.sh
#
# After running, add these GitHub repository secrets:
#   DEPLOY_HOST   — server IP or hostname
#   DEPLOY_USER   — deploy (created below)
#   DEPLOY_KEY    — private SSH key (public key added to deploy user below)
#   DEPLOY_PORT   — 22 (or your custom SSH port)
set -euo pipefail

REPO_URL="https://github.com/lpittman-g/Cutline-Industries.git"
APP_DIR="/srv/cutline-industries"
DEPLOY_USER="deploy"

echo "=== Cutline Industries VPS Setup ==="

# System packages
apt-get update -qq
apt-get install -y curl git ufw fail2ban

# Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Create deploy user
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  echo "Created user: $DEPLOY_USER"
fi

# SSH key for GitHub Actions → deploy user
mkdir -p "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
cat > "/home/$DEPLOY_USER/.ssh/authorized_keys" << 'SSHEOF'
# Paste your GitHub Actions deploy public key here
# Generate: ssh-keygen -t ed25519 -C "cutline-deploy" -f ~/.ssh/cutline-deploy
# Add the PUBLIC key (.pub) here and the PRIVATE key to GitHub Secrets → DEPLOY_KEY
SSHEOF
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"

# Clone repo
if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$APP_DIR"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
fi

# Firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Add your deploy public SSH key to /home/deploy/.ssh/authorized_keys"
echo "  2. Copy .env.production to $APP_DIR/.env.production"
echo "  3. cd $APP_DIR && docker compose up -d --build"
echo "  4. Add GitHub Secrets: DEPLOY_HOST, DEPLOY_USER=deploy, DEPLOY_KEY, DEPLOY_PORT=22"
echo "  5. Point DNS: cutline-industries.studio A record → $(curl -s4 ifconfig.me)"
echo ""
echo "  Caddy will auto-obtain HTTPS certificates when DNS resolves."
