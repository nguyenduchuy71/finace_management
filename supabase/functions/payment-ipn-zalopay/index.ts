// supabase/functions/payment-ipn-zalopay/index.ts
//
// Callback của ZaloPay (server-to-server). Logic + thứ tự kiểm ở _shared/payment-ipn-handlers.ts.
// Deploy: supabase functions deploy payment-ipn-zalopay --no-verify-jwt   (ZaloPay không gửi JWT Supabase)
// callback_url (gửi kèm mỗi request create; nên đăng ký thêm ở portal ZaloPay): ${SUPABASE_URL}/functions/v1/payment-ipn-zalopay

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadPaymentConfig } from '../_shared/payment-config.ts'
import type { PaymentDb } from '../_shared/payment-types.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cfg = loadPaymentConfig((k) => Deno.env.get(k))

import { handleZaloPayCallback } from '../_shared/payment-ipn-handlers.ts'

serve((req) => handleZaloPayCallback(req, { db: db as unknown as PaymentDb, cfg }))
