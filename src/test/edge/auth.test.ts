// @vitest-environment node
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  corsHeaders,
  errorResponse,
  isAllowedReturnUrl,
  isSafeReturnPath,
  readJsonBody,
  requireCronOrUser,
  requireUser,
  safeEqual,
} from "../../../supabase/functions/_shared/auth";
import { makeFake, post, USER_ID } from "./fakes";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const status = (r: unknown) => (r as Response).status;

describe("requireUser", () => {
  it("rejects a missing Authorization header", async () => {
    const f = makeFake();
    const req = new Request("https://x.test", { method: "POST", body: "{}" });
    expect(status(await requireUser(req, f.deps))).toBe(401);
    expect(f.clientsMade).toBe(0);
  });

  it("rejects non-Bearer schemes and an empty bearer", async () => {
    const f = makeFake();
    expect(status(await requireUser(post({}, { authorization: "Basic abc" }), f.deps))).toBe(401);
    expect(status(await requireUser(post({}, { authorization: "good-token" }), f.deps))).toBe(401);
    expect(status(await requireUser(post({}, { authorization: "Bearer " }), f.deps))).toBe(401);
  });

  it("rejects the anon key (a valid JWT with no user)", async () => {
    const f = makeFake();
    const r = await requireUser(post({}, { authorization: "Bearer the-public-anon-key" }), f.deps);
    expect(status(r)).toBe(401);
  });

  it("rejects forged and expired tokens", async () => {
    const f = makeFake();
    expect(status(await requireUser(post({}, { authorization: "Bearer forged.jwt.value" }), f.deps))).toBe(401);
    expect(status(await requireUser(post({}, { authorization: "Bearer expired.jwt.value" }), f.deps))).toBe(401);
  });

  it("rejects anonymous-sign-in users", async () => {
    const f = makeFake({ users: { "good-token": { id: USER_ID, is_anonymous: true } } });
    expect(status(await requireUser(post({}), f.deps))).toBe(401);
  });

  it("fails closed when the auth backend throws", async () => {
    const f = makeFake({ getUserThrows: true });
    expect(status(await requireUser(post({}), f.deps))).toBe(401);
  });

  it("fails closed when the auth backend times out", async () => {
    const f = makeFake({ getUserHangs: true, timeoutMs: 20 });
    expect(status(await requireUser(post({}), f.deps))).toBe(401);
  });

  it("returns 403 for a valid but unapproved account, and for a missing profile", async () => {
    expect(status(await requireUser(post({}), makeFake({ approved: false }).deps))).toBe(403);
    expect(status(await requireUser(post({}), makeFake({ approved: null }).deps))).toBe(403);
  });

  it("returns 503 (not allow) when the approval lookup errors", async () => {
    expect(status(await requireUser(post({}), makeFake({ approved: "error" }).deps))).toBe(503);
  });

  it("accepts a valid approved user and returns identity from the verified token only", async () => {
    const f = makeFake({ approved: true });
    const r = await requireUser(post({ user_id: "attacker-supplied" }), f.deps);
    expect(r instanceof Response).toBe(false);
    expect((r as { user: { id: string } }).user.id).toBe(USER_ID);
  });
});

describe("requireCronOrUser", () => {
  const cronEnv = { DESK_CRON_SECRET: "s3cret-value" };

  it("accepts the correct cron secret without building a user client", async () => {
    const f = makeFake({ env: cronEnv });
    const r = await requireCronOrUser(post({}, { "x-cron-secret": "s3cret-value", authorization: "" }), f.deps);
    expect(r).toEqual({ mode: "cron" });
    expect(f.clientsMade).toBe(0);
  });

  it("rejects a wrong secret even if a valid user token is also sent", async () => {
    const f = makeFake({ env: cronEnv });
    expect(status(await requireCronOrUser(post({}, { "x-cron-secret": "nope" }), f.deps))).toBe(401);
  });

  it("denies when the secret env is unset, even if the header is present", async () => {
    const f = makeFake();
    expect(status(await requireCronOrUser(post({}, { "x-cron-secret": "anything" }), f.deps))).toBe(401);
  });

  it("denies empty header with empty env, and empty header with a real secret", async () => {
    expect(status(await requireCronOrUser(post({}, { "x-cron-secret": "" }), makeFake({ env: { DESK_CRON_SECRET: "" } }).deps))).toBe(401);
    expect(status(await requireCronOrUser(post({}, { "x-cron-secret": "" }), makeFake({ env: cronEnv }).deps))).toBe(401);
  });

  it("falls through to user auth when no cron header is present", async () => {
    const f = makeFake({ env: cronEnv });
    const ok = await requireCronOrUser(post({}), f.deps);
    expect((ok as { mode: string }).mode).toBe("user");
    expect(status(await requireCronOrUser(post({}, { authorization: "Bearer anon-key" }), f.deps))).toBe(401);
  });
});

describe("safeEqual", () => {
  it("compares correctly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("CORS", () => {
  const env = (k: string) => ({ APP_URL: "https://app.example.test/, https://www.example.test" }[k]);
  const hdr = (origin?: string) => corsHeaders(new Request("https://x.test", { headers: origin ? { origin } : {} }), env);

  it("echoes an allowed APP_URL origin (trailing slash and list tolerated)", () => {
    expect(hdr("https://app.example.test")["Access-Control-Allow-Origin"]).toBe("https://app.example.test");
    expect(hdr("https://www.example.test")["Access-Control-Allow-Origin"]).toBe("https://www.example.test");
  });

  it("allows localhost dev origins", () => {
    expect(hdr("http://localhost:8080")["Access-Control-Allow-Origin"]).toBe("http://localhost:8080");
  });

  it("never echoes an unlisted origin", () => {
    expect(hdr("https://evil.example")["Access-Control-Allow-Origin"]).toBe("https://app.example.test");
    expect(hdr()["Access-Control-Allow-Origin"]).toBe("https://app.example.test");
  });

  it("never returns * even when APP_URL is '*' or unset", () => {
    for (const v of ["*", undefined, ""]) {
      const h = corsHeaders(new Request("https://x.test", { headers: { origin: "https://evil.example" } }), (k) => (k === "APP_URL" ? v : undefined));
      expect(h["Access-Control-Allow-Origin"]).not.toBe("*");
      expect(h["Access-Control-Allow-Origin"]).not.toBe("https://evil.example");
    }
  });

  it("sets Vary: Origin and allows x-cron-secret", () => {
    const h = hdr("https://app.example.test");
    expect(h.Vary).toBe("Origin");
    expect(h["Access-Control-Allow-Headers"]).toContain("x-cron-secret");
  });
});

describe("readJsonBody", () => {
  const env = () => undefined;
  const mk = (body: BodyInit | null, headers: Record<string, string> = {}) =>
    new Request("https://x.test", { method: "POST", headers, body, ...(body instanceof ReadableStream ? { duplex: "half" } : {}) } as RequestInit);

  it("parses a normal body", async () => {
    const r = await readJsonBody(mk('{"a":1}'), env, 100);
    expect(r).toEqual({ ok: true, body: { a: 1 } });
  });

  it("rejects an oversize content-length with 413", async () => {
    const r = await readJsonBody(mk('{"a":1}', { "content-length": "999999" }), env, 100);
    expect(r.ok).toBe(false);
    expect((r as { response: Response }).response.status).toBe(413);
  });

  it("counts streamed bytes when there is no content-length (or it lies)", async () => {
    const big = new ReadableStream<Uint8Array>({
      start(c) {
        const chunk = new TextEncoder().encode("x".repeat(60));
        c.enqueue(chunk);
        c.enqueue(chunk);
        c.close();
      },
    });
    const req = new Request("https://x.test", { method: "POST", body: big, duplex: "half", headers: { "content-length": "5" } } as RequestInit);
    const r = await readJsonBody(req, env, 100);
    expect(r.ok).toBe(false);
    expect((r as { response: Response }).response.status).toBe(413);
  });

  it("returns 400 for invalid JSON and for an empty body unless allowed", async () => {
    expect(((await readJsonBody(mk("{nope"), env, 100)) as { response: Response }).response.status).toBe(400);
    expect(((await readJsonBody(mk(""), env, 100)) as { response: Response }).response.status).toBe(400);
    expect(await readJsonBody(mk(""), env, 100, { allowEmpty: true })).toEqual({ ok: true, body: {} });
  });
});

describe("errorResponse", () => {
  it("never leaks the internal message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const SENTINEL = "SECRET-INTERNAL-sk-live-12345";
    const res = errorResponse(post({}), () => "https://app.example.test", 500, new Error(SENTINEL));
    const text = await res.text();
    expect(text).not.toContain(SENTINEL);
    expect(JSON.parse(text)).toEqual({ error: "Server error" });
    expect(console.error).toHaveBeenCalled();
  });

  it("uses fixed messages per status", async () => {
    const env = () => undefined;
    const m = async (s: number) => (await errorResponse(post({}), env, s).json()).error;
    expect(await m(401)).toBe("Unauthorized");
    expect(await m(403)).toBe("Forbidden");
    expect(await m(413)).toBe("Payload too large");
    expect(await m(429)).toBe("Rate limit reached");
    expect(await m(418)).toBe("Server error");
  });
});

describe("return URL helpers", () => {
  const env = (k: string) => (k === "APP_URL" ? "https://app.example.test" : undefined);
  it("accepts only APP_URL origins", () => {
    expect(isAllowedReturnUrl("https://app.example.test/dashboard", env)).toBe(true);
    expect(isAllowedReturnUrl("https://evil.example/dashboard", env)).toBe(false);
    expect(isAllowedReturnUrl("javascript:alert(1)", env)).toBe(false);
    expect(isAllowedReturnUrl("http://localhost:8080/x", env)).toBe(false);
  });
  it("accepts only same-site paths", () => {
    expect(isSafeReturnPath("/dashboard")).toBe(true);
    expect(isSafeReturnPath("//evil.example")).toBe(false);
    expect(isSafeReturnPath("https://evil.example")).toBe(false);
    expect(isSafeReturnPath("/\\evil.example")).toBe(false);
    expect(isSafeReturnPath("dashboard")).toBe(false);
    expect(isSafeReturnPath(undefined)).toBe(false);
  });
});
