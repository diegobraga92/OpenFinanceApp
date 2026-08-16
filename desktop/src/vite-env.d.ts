/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional backend base URL baked in at build time (Vite env). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
