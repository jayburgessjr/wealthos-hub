// stripe-checkout request handler (separate from index.ts so Vitest can import it).
// Price and plan logic is unchanged. Hardening: verified user, shared CORS, APP_URL-only return URLs.
import {
  appOrigins,
  errorResponse,
  isResponse,
  isSafeReturnPath,
  jsonResponse,
  preflight,
  readJsonBody,
  requireUser,
  type AuthDeps,
} from "../_shared/auth.ts";
import { BODY_CAP_BYTES } from "../_shared/limits.ts";

/** The subset of the Stripe SDK this function uses. */
export interface StripeLike {
  customers: { create(args: Record<string, unknown>): Promise<{ id: string }> };
  checkout: { sessions: { create(args: Record<string, unknown>): Promise<{ url: string | null }> } };
}

export interface CheckoutDeps {
  auth: AuthDeps;
  makeStripe(secretKey: string): StripeLike;
}

/**
 * Return URLs are built from the APP_URL allowlist only (first entry); the caller's Origin header is ignored.
 * An optional `returnPath` is accepted only as a same-site path. Returns null when APP_URL is unset.
 */
export function buildReturnUrls(env: AuthDeps["env"], returnPath?: unknown): { success: string; cancel: string } | null {
  const base = appOrigins(env)[0];
  if (!base) return null;
  const path = isSafeReturnPath(returnPath) ? returnPath : "/dashboard";
  const sep = path.includes("?") ? "&" : "?";
  return { success: `${base}${path}${sep}session_id={CHECKOUT_SESSION_ID}`, cancel: `${base}${path}` };
}

export async function handle(req: Request, deps: CheckoutDeps): Promise<Response> {
  const env = deps.auth.env;
  try {
    const pre = preflight(req, env);
    if (pre) return pre;

    const auth = await requireUser(req, deps.auth);
    if (isResponse(auth)) return auth;
    const { user, client: supabaseClient } = auth;

    const bodyRes = await readJsonBody(req, env, BODY_CAP_BYTES.default, { allowEmpty: true });
    if (!bodyRes.ok) return bodyRes.response;
    const returnPath = (bodyRes.body as { returnPath?: unknown } | null)?.returnPath;

    const urls = buildReturnUrls(env, returnPath);
    if (!urls) return errorResponse(req, env, 500, "APP_URL is not configured");

    const stripe = deps.makeStripe(env("STRIPE_SECRET_KEY") ?? "");

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseClient
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: env("STRIPE_PRO_PRICE_ID"),
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: urls.success,
      cancel_url: urls.cancel,
    });

    return jsonResponse(req, env, { url: session.url });
  } catch (error) {
    return errorResponse(req, env, 500, error);
  }
}
