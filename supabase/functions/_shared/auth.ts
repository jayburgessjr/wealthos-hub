// Shared auth, CORS, body and error helpers for non-desk edge functions.
// Pure TypeScript: no npm: specifiers and no Deno.* here, so Vitest can import it directly.
// Deno-only wiring (env, supabase client creation) lives in auth-deno.ts and is injected as `deps`.

export type Env = (key: string) => string | undefined;

/** The subset of a supabase-js client that auth needs. Satisfied by the real client and by test fakes. */
export interface UserClient {
  auth: {
    getUser(): PromiseLike<{
      data: { user: { id: string; email?: string | null; is_anonymous?: boolean } | null };
      error: unknown;
    }>;
  };
  // The supabase query builder is deliberately untyped here so test fakes can stay small.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

export interface AuthDeps {
  env: Env;
  /** Builds a client that carries the caller's Authorization header (anon key + caller JWT, RLS applies). */
  makeUserClient(authHeader: string): UserClient;
  /** getUser timeout in ms (default 5000). */
  timeoutMs?: number;
}

export interface AuthedUser {
  mode: "user";
  user: { id: string; email: string | null };
  client: UserClient;
}

export interface CronCaller {
  mode: "cron";
}

// ── Errors ──────────────────────────────────────────────────────────────────

const PUBLIC_MESSAGES: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  405: "Method not allowed",
  413: "Payload too large",
  429: "Rate limit reached",
  500: "Server error",
  502: "Upstream error",
  503: "Service unavailable",
};

// ── CORS ────────────────────────────────────────────────────────────────────

const LOCAL_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

const stripSlash = (s: string) => s.trim().replace(/\/+$/, "");

/** APP_URL may hold several comma-separated origins. */
export function appOrigins(env: Env): string[] {
  return (env("APP_URL") ?? "")
    .split(",")
    .map(stripSlash)
    .filter((s) => s.length > 0 && s !== "*");
}

export function corsHeaders(req: Request, env: Env): Record<string, string> {
  const apps = appOrigins(env);
  const origin = req.headers.get("origin") ?? "";
  const allowed = [...apps, ...LOCAL_ORIGINS];
  // Never "*" and never reflect an unlisted origin. An unlisted caller gets the first app origin,
  // which a browser rejects for them.
  const allow = allowed.includes(origin) ? origin : apps[0] ?? "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonResponse(req: Request, env: Env, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req, env), "Content-Type": "application/json", ...extra },
  });
}

export const optionsResponse = (req: Request, env: Env): Response => new Response(null, { status: 204, headers: corsHeaders(req, env) });

/** Logs `internal` server-side and returns only a fixed public message. Raw error text is never returned. */
export function errorResponse(req: Request, env: Env, status: number, internal?: unknown, extra: Record<string, string> = {}): Response {
  if (internal !== undefined) console.error(`[edge ${status}]`, internal);
  return jsonResponse(req, env, { error: PUBLIC_MESSAGES[status] ?? PUBLIC_MESSAGES[500] }, status, extra);
}

/** Handles OPTIONS and rejects non-POST. Returns null when the request should continue. */
export function preflight(req: Request, env: Env): Response | null {
  if (req.method === "OPTIONS") return optionsResponse(req, env);
  if (req.method !== "POST") return errorResponse(req, env, 405);
  return null;
}

// ── Body ────────────────────────────────────────────────────────────────────

// Optional cross-fields keep property access type-safe when strictNullChecks is off (it is, repo-wide).
export type BodyResult = { ok: true; body: unknown; response?: undefined } | { ok: false; response: Response; body?: undefined };

/**
 * Reads a JSON body with a hard byte cap. Rejects on a content-length over the cap and also counts the
 * streamed bytes (the header can be absent or lie). An empty body is `{}` when allowEmpty is set.
 */
export async function readJsonBody(req: Request, env: Env, maxBytes: number, opts: { allowEmpty?: boolean } = {}): Promise<BodyResult> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, response: errorResponse(req, env, 413) };

  const chunks: Uint8Array[] = [];
  let total = 0;
  if (req.body) {
    const reader = req.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, response: errorResponse(req, env, 413) };
        }
        chunks.push(value);
      }
    } catch (e) {
      return { ok: false, response: errorResponse(req, env, 400, e) };
    }
  }
  if (total === 0) {
    return opts.allowEmpty ? { ok: true, body: {} } : { ok: false, response: errorResponse(req, env, 400, "empty body") };
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch (e) {
    return { ok: false, response: errorResponse(req, env, 400, e) };
  }
}

// ── Comparison and URLs ─────────────────────────────────────────────────────

/** Constant-time string compare (length is not secret). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when `url` is absolute and its origin is one of APP_URL's origins (localhost is NOT accepted here). */
export function isAllowedReturnUrl(url: string, env: Env): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return appOrigins(env).includes(u.origin);
  } catch {
    return false;
  }
}

/** A return path must be a same-site path: starts with a single "/", no scheme, backslash or control chars. */
export function isSafeReturnPath(p: unknown): p is string {
  if (typeof p !== "string" || p.length > 200 || !p.startsWith("/") || p.startsWith("//") || p.includes("://")) return false;
  for (let i = 0; i < p.length; i++) {
    const c = p.charCodeAt(i);
    if (c === 0x5c || c < 0x20) return false; // backslash or control character
  }
  return true;
}

// ── Authentication ──────────────────────────────────────────────────────────

const isResponse = (x: unknown): x is Response => x instanceof Response;

export function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Verifies the caller's JWT with auth.getUser() and that the account is approved (profiles.access_approved).
 * The anon key is a valid JWT but has no user, so it is rejected. Returns a Response on failure.
 */
export async function requireUser(req: Request, deps: AuthDeps): Promise<AuthedUser | Response> {
  const { env } = deps;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/.test(authHeader)) return errorResponse(req, env, 401);

  let client: UserClient;
  let user: { id: string; email?: string | null; is_anonymous?: boolean } | null = null;
  try {
    client = deps.makeUserClient(authHeader);
    const res = await withTimeout(client.auth.getUser(), deps.timeoutMs ?? 5000);
    if (res.error || !res.data?.user?.id) return errorResponse(req, env, 401);
    user = res.data.user;
  } catch (e) {
    return errorResponse(req, env, 401, e);
  }
  if (user.is_anonymous === true) return errorResponse(req, env, 401);

  // Approved-user gate. A user can read their own profile row through RLS.
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(client.from("profiles").select("access_approved").eq("id", user.id).maybeSingle()),
      deps.timeoutMs ?? 5000,
    );
    if (error) return errorResponse(req, env, 503, error);
    if (!data || (data as { access_approved?: unknown }).access_approved !== true) return errorResponse(req, env, 403);
  } catch (e) {
    return errorResponse(req, env, 503, e);
  }
  return { mode: "user", user: { id: user.id, email: user.email ?? null }, client };
}

/**
 * Cron callers present x-cron-secret (compared in constant time with DESK_CRON_SECRET; unset or empty = deny).
 * Everyone else must be an approved user.
 */
export async function requireCronOrUser(req: Request, deps: AuthDeps): Promise<AuthedUser | CronCaller | Response> {
  if (req.headers.has("x-cron-secret")) {
    const expected = deps.env("DESK_CRON_SECRET") ?? "";
    const got = req.headers.get("x-cron-secret") ?? "";
    if (!expected || !got || !safeEqual(expected, got)) return errorResponse(req, deps.env, 401);
    return { mode: "cron" };
  }
  return requireUser(req, deps);
}

export { isResponse };

// ── Outbound fetch with timeout ─────────────────────────────────────────────

export function fetchT(url: string, init: RequestInit = {}, ms = 20000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}
