/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_MAGICBLOCK_KILL_TX?: string;
    readonly VITE_MAGICBLOCK_ROUTER_URL?: string;
    readonly VITE_MAGICBLOCK_SIGNER_SECRET_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

