// supabase/functions/create-payment/index.ts
//
// Tạo đơn nạp credit (MoMo / ZaloPay) và đối soát đơn của chính user. Logic ở _shared/payment-create-handler.ts.
// Deploy: supabase functions deploy create-payment   (verify_jwt bật; function còn tự getUser từ token)
// Gọi từ app: supabase.functions.invoke('create-payment', { body: { action: 'create', provider, package_id } })

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadPaymentConfig } from '../_shared/payment-config.ts'
import type { PaymentDb } from '../_shared/payment-types.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cfg = loadPaymentConfig((k) => Deno.env.get(k))

import { bearerToken } from '../_shared/http.ts'
import { handleCreatePayment } from '../_shared/payment-create-handler.ts'

serve((req) => handleCreatePayment(req, {
  db: db as unknown as PaymentDb,
  cfg,
  fetchFn: fetch,
  nowMs: () => Date.now(),
  async authenticate(r) {
    const token = bearerToken(r.headers)
    if (!token) return null
    // User lấy TỪ token (GoTrue kiểm chữ ký + hạn), không nhận user id từ body.
    const { data, error } = await db.auth.getUser(token)
    return error || !data.user ? null : data.user.id
  },
}))
