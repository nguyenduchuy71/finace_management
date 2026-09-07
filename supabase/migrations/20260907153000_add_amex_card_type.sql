-- Thêm 'amex' vào card_type.
--
-- Thẻ American Express có BIN 34xx/37xx và chỉ 15 số (thay vì 16), không thuộc
-- visa/mastercard/jcb. Danh sách thẻ thực tế của user có Sacombank Amex (3709-...)
-- nên constraint cũ chặn không insert được.
--
-- Đồng bộ với Zod `CreditCardSchema.cardType` ở src/types/creditCard.ts.

alter table public.credit_cards
  drop constraint if exists credit_cards_card_type_check;

alter table public.credit_cards
  add constraint credit_cards_card_type_check
  check (card_type in ('visa', 'mastercard', 'jcb', 'amex'));
