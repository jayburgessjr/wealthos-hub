import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.revuitysys.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only authenticated users may call this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify caller is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the invitation
    const { data: invitation, error: invErr } = await supabase
      .from("invitations")
      .select("id, token, household_id, email, status, invited_by")
      .eq("token", token)
      .single();

    if (invErr || !invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invitation.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Invitation is no longer pending" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Caller must be owner of the household
    const { data: memberRow } = await supabase
      .from("household_members")
      .select("role")
      .eq("household_id", invitation.household_id)
      .eq("user_id", user.id)
      .single();

    if (!memberRow || memberRow.role !== "owner") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch household name for email
    const { data: household } = await supabase
      .from("households")
      .select("name")
      .eq("id", invitation.household_id)
      .single();

    const householdName = household?.name ?? "a household";
    const acceptUrl = `${APP_URL}/household/invite/${token}`;

    if (!RESEND_API_KEY) {
      // Log and return success so the invitation record is still usable
      console.warn("RESEND_API_KEY not set — skipping email send");
      return new Response(
        JSON.stringify({ success: true, sent: false, acceptUrl }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AJE <noreply@revuitysys.com>",
        to: [invitation.email],
        subject: `You're invited to join ${householdName} on AJE`,
        html: `
          <div style="font-family:monospace;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:8px">You're invited!</h2>
            <p>You have been invited to join <strong>${householdName}</strong> on AJE — your AI-powered personal finance dashboard.</p>
            <p style="margin:24px 0">
              <a href="${acceptUrl}"
                 style="background:#059669;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold;display:inline-block">
                Accept Invitation
              </a>
            </p>
            <p style="font-size:12px;color:#666">
              Or copy this link into your browser:<br/>
              <code>${acceptUrl}</code>
            </p>
            <p style="font-size:11px;color:#999;margin-top:32px">
              This invitation expires and can only be used once. If you did not expect this email, you can ignore it.
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const body = await emailRes.text();
      console.error("Resend error:", body);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-household-invite error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
