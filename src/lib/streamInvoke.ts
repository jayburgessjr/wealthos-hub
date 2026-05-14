/**
 * streamInvoke — calls a Supabase edge function with the authenticated user's
 * real JWT (not the anon/publishable key) and streams the SSE response.
 *
 * Use this instead of bare fetch() for any edge function that:
 *   1. Has an auth guard (Bearer token required)
 *   2. Returns a streaming SSE response
 *
 * Falls back gracefully if no active session exists.
 */

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}

export async function streamInvoke(
  functionName: string,
  body: Record<string, unknown>,
  callbacks: StreamCallbacks
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    callbacks.onError("Not authenticated — please sign in.");
    return;
  }

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    callbacks.onError("Network error — could not reach the server.");
    return;
  }

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    callbacks.onError(errBody.error ?? `Request failed (${resp.status})`);
    return;
  }

  if (!resp.body) {
    callbacks.onError("No response body from server.");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        callbacks.onDone();
        return;
      }
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content ?? "";
        if (delta) callbacks.onDelta(delta);
      } catch {
        // non-JSON line — skip
      }
    }
  }

  callbacks.onDone();
}
