// supabase/functions/payment-reconcile/index.ts
//
// Đối soát đơn pending (IPN bị mất) + hết hạn đơn quá hạn. Logic ở _shared/payment-reconcile-handler.ts.
// Deploy: supabase functions deploy payment-reconcile --no-verify-jwt   (xác thực bằng header x-reconcile-secret)
// Secret: supabase secrets set RECONCILE_SECRET=<chuỗi ngẫu nhiên dài>; scheduler gọi POST mỗi ~5 phút.

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadPaymentConfig } from '../_shared/payment-config.ts'
import type { PaymentDb } from '../_shared/payment-types.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cfg = loadPaymentConfig((k) => Deno.env.get(k))

import { handleReconcile } from '../_shared/payment-reconcile-handler.ts'

serve((req) => handleReconcile(req, {
  db: db as unknown as PaymentDb,
  cfg,
  fetchFn: fetch,
  secret: Deno.env.get('RECONCILE_SECRET'),
}))
