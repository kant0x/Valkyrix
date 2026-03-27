#!/usr/bin/env bash
set -e

echo "=== Building valkyrix-recorder Anchor program ==="
cd "$(dirname "$0")/../anchor"
anchor build

echo "=== Deploying to Solana devnet ==="
anchor deploy --provider.cluster devnet

echo ""
echo "=== Deploy complete ==="
echo "Copy the program ID printed above and update:"
echo "  1. src/blockchain/blockchain.types.ts -> VALKYRIX_LEDGER_PROGRAM_ID"
echo "  2. anchor/Anchor.toml -> [programs.devnet] valkyrix_recorder"
echo "  3. anchor/programs/valkyrix-recorder/src/lib.rs -> declare_id!()"
echo ""
echo "Then run: npm run init:soar:devnet"
