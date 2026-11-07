// Shared fakes for the edge-function tests (no Deno, no network).
import type { AuthDeps, UserClient } from "../../../supabase/functions/_shared/auth";

export const USER_ID = "11111111-1111-1111-1111-111111111111";

export interface FakeOpts {
  /** token -> user; unknown tokens (including the anon key) return no user, like Supabase does. */
  users?: Record<string, { id: string; email?: string; is_anonymous?: boolean }>;
  approved?: boolean | null | "error";
  rpc?: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown };
  getUserThrows?: boolean;
  getUserHangs?: boolean;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface Fake {
  deps: AuthDeps;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  clientsMade: number;
  updates: { table: string; values: Record<string, unknown> }[];
}

export function makeFake(opts: FakeOpts = {}): Fake {
  const users = opts.users ?? { "good-token": { id: USER_ID, email: "u@example.test" } };
  const env = { APP_URL: "https://app.example.test", ...opts.env };
  const fake: Fake = { rpcCalls: [], clientsMade: 0, updates: [], deps: undefined as never };

  const makeUserClient = (authHeader: string): UserClient => {
    fake.clientsMade++;
    const token = authHeader.replace(/^Bearer\s+/, "");
    return {
      auth: {
        getUser: () => {
          if (opts.getUserThrows) return Promise.reject(new Error("auth backend down"));
          if (opts.getUserHangs) return new Promise(() => undefined);
          const u = users[token];
          return Promise.resolve(u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } });
        },
      },
      from: (table: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          single: () => chain.maybeSingle(),
          maybeSingle: () => {
            if (opts.approved === "error") return Promise.resolve({ data: null, error: { message: "db down" } });
            if (opts.approved === null) return Promise.resolve({ data: null, error: null });
            return Promise.resolve({ data: { access_approved: opts.approved ?? true, stripe_customer_id: "cus_existing" }, error: null });
          },
          update: (values: Record<string, unknown>) => {
            fake.updates.push({ table, values });
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
        return chain;
      },
      rpc: (fn: string, args: Record<string, unknown> = {}) => {
        fake.rpcCalls.push({ fn, args });
        const r = opts.rpc ? opts.rpc(fn, args) : { data: fn === "consume_usage" ? 1 : null, error: null };
        return Promise.resolve(r);
      },
    };
  };

  fake.deps = { env: (k) => env[k], makeUserClient, timeoutMs: opts.timeoutMs };
  return fake;
}

export const post = (body: unknown, headers: Record<string, string> = {}, url = "https://x.test/fn") =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer good-token", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
