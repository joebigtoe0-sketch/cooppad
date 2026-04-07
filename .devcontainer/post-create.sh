#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing system packages for Solana / Anchor builds..."
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  pkg-config \
  libudev-dev \
  libssl-dev \
  libclang-dev \
  build-essential \
  protobuf-compiler \
  git \
  curl

# Solana CLI — keep in sync with programs/moonpad/Cargo.toml (solana-program = "1.18.26")
SOLANA_RELEASE="1.18.26"
echo "==> Installing Solana CLI ${SOLANA_RELEASE}..."
sh -c "$(curl -sSfL https://release.solana.com/v${SOLANA_RELEASE}/install)"

# Rust / Cargo (feature already installed rustup; ensure env is loaded)
if [[ -f "${HOME}/.cargo/env" ]]; then
  # shellcheck source=/dev/null
  source "${HOME}/.cargo/env"
fi

echo "==> Installing AVM + Anchor 0.30.1 (see Anchor.toml)..."
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1

export PATH="${HOME}/.local/share/solana/install/active_release/bin:${HOME}/.cargo/bin:${HOME}/.avm/bin:${PATH}"

# Persist PATH for interactive shells (remoteEnv covers VS Code tasks in many cases)
if ! grep -q 'solana/install/active_release/bin' "${HOME}/.bashrc"; then
  cat >> "${HOME}/.bashrc" <<'EOF'

# Solana + Anchor (devcontainer)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"
EOF
fi

echo "==> Tool versions:"
solana --version
anchor --version
rustc --version
node --version

echo "==> Done. Open a new terminal, then: cd moonpad && anchor build"
