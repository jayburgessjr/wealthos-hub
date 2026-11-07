# invite-owner-check
Objective: send-household-invite returned 403 for everyone because it queried non-existent `household_members`. Membership is `public.user_roles` (user_id, household_id, role owner|member).
Scope: supabase/functions/send-household-invite/{index.ts,owner.ts}, src/test/edge/send-household-invite.test.ts. No schema/RLS/other functions/frontend.
Acceptance: owner of invitation's household passes; member, no row, other-household owner get 403; ownership checked before status (409) and before any send; 404 unknown invitation unchanged; escapeHtml and shared CORS retained.
Design: pure `callerIsOwner(client, userId, householdId)` / `isOwnerRow` in owner.ts (no Deno imports), used by index.ts.
