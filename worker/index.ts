/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runJobs } from "../app/api/jobs/route";
import { setRuntimeEnv } from "../lib/runtime-env";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async scheduled(_controller: unknown, _env: Env, ctx: ExecutionContext) {setRuntimeEnv(_env as unknown as Record<string,unknown>);ctx.waitUntil(runJobs());},
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setRuntimeEnv(env as unknown as Record<string,unknown>);
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    if (response.status === 101) return response;
    const secured = new Response(response.body, response);
    secured.headers.set("X-Content-Type-Options","nosniff");
    secured.headers.set("Referrer-Policy","no-referrer");
    secured.headers.set("X-Frame-Options","DENY");
    secured.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=(self)");
    secured.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    if(url.protocol==="https:")secured.headers.set("Strict-Transport-Security","max-age=31536000");
    if (/^\/(api|account|manage-booking|admin|dispatch|driver|partner|sign-in)(\/|$)/.test(url.pathname)) { secured.headers.set("Cache-Control","no-store"); secured.headers.set("X-Robots-Tag","noindex, nofollow"); }
    return secured;
  },
};

export default worker;
