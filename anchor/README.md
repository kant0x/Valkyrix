# Valkyrix Anchor Workspace

This workspace contains the Solana smart contract for Valkyrix.

Program:
- `programs/valkyrix_ledger`

Primary documentation:
- [docs/SMART_CONTRACT.md](/e:/py_scrypt/карта%20валкирикс/docs/SMART_CONTRACT.md)

Quick start:
1. Install Solana CLI and Anchor CLI.
2. Fund your devnet wallet.
3. Build with `anchor build` from this directory.
4. Deploy with `anchor deploy --provider.cluster devnet`.

Important:
- Replace the placeholder program id before production deployment.
- This contract is the authoritative on-chain event ledger.
- MagicBlock is used as the fast execution layer on top of this contract, not as a replacement for it.
