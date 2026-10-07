// Cloudflare bindings are injected by its Worker entry; Vercel reads process.env.
export const env:Record<string,unknown> = {};
export function setRuntimeEnv(bindings:Record<string,unknown>) { Object.assign(env,bindings); }
