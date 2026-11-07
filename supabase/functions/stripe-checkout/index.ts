import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.10.0";
import { realAuthDeps } from "../_shared/auth-deno.ts";
import { handle } from "./handler.ts";

serve((req) =>
  handle(req, {
    auth: realAuthDeps(),
    makeStripe: (key: string) => new Stripe(key, { apiVersion: "2023-10-16" }) as never,
  }),
);
