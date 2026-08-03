/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVICE_NOW_BASE_URL: string;
  readonly VITE_SERVICE_NOW_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
