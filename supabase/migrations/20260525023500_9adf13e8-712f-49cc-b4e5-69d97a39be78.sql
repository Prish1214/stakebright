DO $$
DECLARE
  r record;
  v_qual_amount numeric;
BEGIN
  FOR r IN
    SELECT c.user_id AS referee_id, c.referred_by AS referrer_id
    FROM public.profiles c
    WHERE c.referred_by IS NOT NULL
      AND c.referred_by <> c.user_id
      AND public.staking_referral_qualifying_total(c.user_id) >= 50
      AND NOT EXISTS (
        SELECT 1
        FROM public.referral_earnings re
        WHERE re.referrer_id = c.referred_by
          AND re.referred_id = c.user_id
          AND (
            re.kind = 'activation'
            OR EXISTS (
              SELECT 1
              FROM public.deposits d
              WHERE d.id = re.deposit_id
                AND d.target_wallet = 'staking'
                AND d.status = 'approved'
            )
          )
      )
  LOOP
    v_qual_amount := LEAST(
      public.staking_referral_qualifying_total(r.referee_id),
      COALESCE((
        SELECT SUM((l.metadata->>'delta')::numeric)
        FROM public.admin_activity_logs l
        WHERE l.target_type = 'user'
          AND l.target_id = r.referee_id::text
          AND l.action IN ('adjust_balance','credit_reward')
          AND l.metadata->>'wallet' = 'staking'
          AND (l.metadata->>'delta') ~ '^-?[0-9]+(\.[0-9]+)?$'
          AND (l.metadata->>'delta')::numeric > 0
      ), 0) + COALESCE((
        SELECT SUM(d.amount)
        FROM public.deposits d
        WHERE d.user_id = r.referee_id
          AND d.status = 'approved'
          AND d.target_wallet = 'staking'
      ), 0)
    );

    PERFORM public.grant_staking_referral_activation_bonus(r.referee_id, v_qual_amount, NULL);
  END LOOP;
END;
$$;