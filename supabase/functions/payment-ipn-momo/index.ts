// supabase/functions/payment-ipn-momo/index.ts
//
// IPN của MoMo (server-to-server). Logic + thứ tự kiểm ở _shared/payment-ipn-handlers.ts.
// Deploy: supabase functions deploy payment-ipn-momo --no-verify-jwt   (MoMo không gửi JWT Supabase)
// IPN URL (gửi kèm mỗi request create): ${SUPABASE_URL}/functions/v1/payment-ipn-momo

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadPaymentConfig } from '../_shared/payment-config.ts'
import type { PaymentDb } from '../_shared/payment-types.ts'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cfg = loadPaymentConfig((k) => Deno.env.get(k))

import { handleMomoIpn } from '../_shared/payment-ipn-handlers.ts'

serve((req) => handleMomoIpn(req, { db: db as unknown as PaymentDb, cfg }))
