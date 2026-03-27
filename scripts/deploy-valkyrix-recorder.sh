#!/usr/bin/env bash
set -e

# Load .env.local if exists
ENV_FILE="$(dirname "$0")/../.env.local"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -E '^(ANCHOR_WALLET|SOLANA_CLUSTER)=' | xargs)
fi

KEYPAIR="${ANCHOR_WALLET:-$HOME/.config/solana/deploy-keypair.json}"
CLUSTER="${SOLANA_CLUSTER:-devnet}"

echo "=== Building valkyrix-recorder Anchor program ==="
echo "Deployer: $(solana-keygen pubkey "$KEYPAIR" 2>/dev/null || echo "$KEYPAIR")"
echo "Cluster:  $CLUSTER"
echo ""

cd "$(dirname "$0")/../anchor"
anchor build

echo ""
echo "=== Deploying to Solana $CLUSTER ==="
anchor deploy \
  --provider.cluster "$CLUSTER" \
  --provider.wallet "$KEYPAIR"

echo ""
echo "=== Deploy complete ==="
echo "Copy the program ID printed above and update:"
echo "  1. src/blockchain/blockchain.types.ts -> VALKYRIX_LEDGER_PROGRAM_ID"
echo "  2. anchor/Anchor.toml -> [programs.devnet] valkyrix_recorder"
echo "  3. anchor/programs/valkyrix-recorder/src/lib.rs -> declare_id!()"
echo ""
echo "Then run: npm run init:soar:devnet"
