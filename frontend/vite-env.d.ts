/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly REACT_APP_STRIPE_PUBLISHABLE_KEY?: string; // ADD THIS LINE
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
