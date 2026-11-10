WITH normalized_amounts AS (
  SELECT
    id,
    GREATEST(COALESCE(amount, amount_ngn, 0), 0)::numeric(14, 2) AS normalized_amount,
    CASE WHEN fee_payer IN ('buyer', 'seller', 'split') THEN fee_payer ELSE 'buyer' END AS normalized_fee_payer
  FROM public.escrow_deals
),
calculated_fees AS (
  SELECT
    id,
    normalized_amount,
    normalized_fee_payer,
    ROUND(normalized_amount * 0.015, 2)::numeric(14, 2) AS platform_fee
  FROM normalized_amounts
),
allocated_fees AS (
  SELECT
    id,
    normalized_amount,
    normalized_fee_payer,
    platform_fee,
    CASE normalized_fee_payer
      WHEN 'buyer' THEN platform_fee
      WHEN 'split' THEN FLOOR(platform_fee * 100 / 2) / 100
      ELSE 0
    END::numeric(14, 2) AS buyer_fee
  FROM calculated_fees
)
UPDATE public.escrow_deals AS deal
SET amount = fees.normalized_amount,
    amount_ngn = fees.normalized_amount,
    fee_payer = fees.normalized_fee_payer,
    platform_fee = fees.platform_fee,
    buyer_fee = fees.buyer_fee,
    seller_fee = fees.platform_fee - fees.buyer_fee
FROM allocated_fees AS fees
WHERE deal.id = fees.id;

UPDATE public.escrow_deals
SET funded_at = COALESCE(funded_at, updated_at, created_at, now()),
    inspection_deadline = COALESCE(
      inspection_deadline,
      COALESCE(funded_at, updated_at, created_at, now()) + interval '48 hours'
    )
WHERE status IN ('funded', 'disputed', 'settling');

CREATE OR REPLACE FUNCTION public.queue_expired_fidulync_settlements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  due_row record;
  payout_amount numeric(14, 2);
  queued_count integer := 0;
BEGIN
  FOR due_row IN
    SELECT
      id,
      COALESCE(amount, amount_ngn, 0) AS amount,
      COALESCE(seller_fee, 0) AS seller_fee,
      currency,
      seller_id
    FROM public.escrow_deals
    WHERE status = 'funded'
      AND inspection_deadline IS NOT NULL
      AND inspection_deadline <= now()
    ORDER BY inspection_deadline
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    payout_amount := GREATEST(0, COALESCE(due_row.amount, 0) - COALESCE(due_row.seller_fee, 0));
    IF payout_amount <= 0 OR due_row.seller_id IS NULL OR due_row.currency IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.escrow_deals
    SET status = 'settling', updated_at = now()
    WHERE id = due_row.id AND status = 'funded';

    IF FOUND THEN
      INSERT INTO public.disbursements (
        deal_id, recipient_id, kind, amount, currency, status, audit_metadata
      )
      VALUES (
        due_row.id, due_row.seller_id, 'seller_payout', payout_amount,
        due_row.currency, 'pending', jsonb_build_object('source', 'hourly_settlement')
      );
      queued_count := queued_count + 1;
    END IF;
  END LOOP;

  RETURN queued_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_fidulync_dispute(
  p_dispute_id uuid,
  p_admin_id uuid,
  p_action text,
  p_seller_amount numeric DEFAULT 0,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dispute_row public.disputes%ROWTYPE;
  deal_row public.escrow_deals%ROWTYPE;
  deal_amount numeric(14, 2);
  platform_fee_amount numeric(14, 2);
  buyer_fee_amount numeric(14, 2);
  seller_fee_amount numeric(14, 2);
  buyer_refund numeric(14, 2);
  seller_payout numeric(14, 2);
BEGIN
  IF p_action NOT IN ('release_to_seller', 'refund_to_buyer', 'split') THEN
    RAISE EXCEPTION 'Invalid dispute resolution action';
  END IF;

  SELECT * INTO dispute_row
  FROM public.disputes
  WHERE id = p_dispute_id
  FOR UPDATE;

  IF NOT FOUND OR dispute_row.status <> 'under_review' THEN
    RAISE EXCEPTION 'Dispute is not awaiting review';
  END IF;

  SELECT * INTO deal_row
  FROM public.escrow_deals
  WHERE id = dispute_row.deal_id
  FOR UPDATE;

  IF NOT FOUND OR deal_row.status <> 'disputed' THEN
    RAISE EXCEPTION 'Escrow funds are not frozen for this dispute';
  END IF;

  deal_amount := GREATEST(COALESCE(deal_row.amount, deal_row.amount_ngn, 0), 0);
  platform_fee_amount := COALESCE(deal_row.platform_fee, ROUND(deal_amount * 0.015, 2));
  buyer_fee_amount := COALESCE(
    deal_row.buyer_fee,
    CASE COALESCE(deal_row.fee_payer, 'buyer')
      WHEN 'buyer' THEN platform_fee_amount
      WHEN 'split' THEN FLOOR(platform_fee_amount * 100 / 2) / 100
      ELSE 0
    END
  );
  seller_fee_amount := COALESCE(deal_row.seller_fee, GREATEST(platform_fee_amount - buyer_fee_amount, 0));

  IF p_action = 'release_to_seller' THEN
    seller_payout := GREATEST(0, deal_amount - seller_fee_amount);
    buyer_refund := 0;
  ELSIF p_action = 'refund_to_buyer' THEN
    seller_payout := 0;
    buyer_refund := deal_amount + buyer_fee_amount;
  ELSE
    IF p_seller_amount IS NULL OR p_seller_amount < 0 OR p_seller_amount > deal_amount - seller_fee_amount THEN
      RAISE EXCEPTION 'Seller split amount is outside the available escrow balance';
    END IF;
    seller_payout := round(p_seller_amount, 2);
    buyer_refund := GREATEST(
      0,
      deal_amount + buyer_fee_amount - platform_fee_amount - seller_payout
    );
  END IF;

  INSERT INTO public.payout_audit_logs (deal_id, dispute_id, admin_id, action, notes, amounts)
  VALUES (
    deal_row.id,
    dispute_row.id,
    p_admin_id,
    p_action,
    left(COALESCE(p_notes, ''), 2000),
    jsonb_build_object('seller_payout', seller_payout, 'buyer_refund', buyer_refund, 'currency', deal_row.currency)
  );

  IF seller_payout > 0 THEN
    INSERT INTO public.disbursements (deal_id, dispute_id, recipient_id, kind, amount, currency, status, audit_metadata)
    VALUES (deal_row.id, dispute_row.id, deal_row.seller_id, 'seller_payout', seller_payout, deal_row.currency, 'pending',
      jsonb_build_object('source', 'dispute_arbitration', 'action', p_action));
  END IF;

  IF buyer_refund > 0 THEN
    INSERT INTO public.disbursements (deal_id, dispute_id, recipient_id, kind, amount, currency, status, audit_metadata)
    VALUES (deal_row.id, dispute_row.id, deal_row.buyer_id, 'buyer_refund', buyer_refund, deal_row.currency, 'pending',
      jsonb_build_object('source', 'dispute_arbitration', 'action', p_action));
  END IF;

  UPDATE public.disputes
  SET status = CASE p_action
        WHEN 'release_to_seller' THEN 'released_to_seller'
        WHEN 'refund_to_buyer' THEN 'refunded_to_buyer'
        ELSE 'split'
      END,
      admin_notes = left(COALESCE(p_notes, ''), 2000),
      resolved_by = p_admin_id,
      resolved_at = now(),
      resolution = jsonb_build_object('seller_payout', seller_payout, 'buyer_refund', buyer_refund, 'currency', deal_row.currency),
      updated_at = now()
  WHERE id = dispute_row.id;

  RETURN jsonb_build_object(
    'dispute_id', dispute_row.id,
    'status', CASE p_action
      WHEN 'release_to_seller' THEN 'released_to_seller'
      WHEN 'refund_to_buyer' THEN 'refunded_to_buyer'
      ELSE 'split'
    END,
    'seller_payout', seller_payout,
    'buyer_refund', buyer_refund
  );
END;
$$;
