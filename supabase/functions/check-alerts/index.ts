import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { makeAdminClient, realAuthDeps } from '../_shared/auth-deno.ts'
import { handle } from './handler.ts'

serve((req) => handle(req, { auth: realAuthDeps(), makeAdminClient }))
