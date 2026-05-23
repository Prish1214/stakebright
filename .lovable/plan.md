## Goal

Replace the legacy Main Wallet (`wallet_balance`) with a unified **Withdrawable Earnings** bucket that holds only staking, mining, and referral rewards. Trading Wallet stays independent and fully withdrawable. Referral logic and qualification rules are rewritten. Mining UI gains clearer status indicators.

## 1. Database migration

**New / renamed columns on `profiles`:**
- Add `withdrawable_earnings NUMERIC NOT NULL DEFAULT 0` — replaces `wallet_balance` semantically.
- Add three breakdown counters (informational, drive the Withdraw breakdown UI):
  - `earnings_staking NUMERIC DEFAULT 0`
  - `earnings_mining NUMERIC DEFAULT 0`
  - `earnings_referral NUMERIC DEFAULT 0`
- Keep `wallet_balance` column for now (we migrate value out, then stop writing to it; will be dropped in a follow-up after frontend cleanup is verified).

**Data migration (one-time):**
- Set `withdrawable_earnings = wallet_balance` for every profile.
- Best-effort backfill of breakdown counters: `earnings_referral = SUM(referral_earnings.amount)`, `earnings_staking = SUM(stakes.total_earned)`, `earnings_mining = SUM(mining_rentals.total_yield)`, then clamp `earnings_staking` so the three sum ≤ `withdrawable_earnings` (residual goes into `earnings_staking`).
- Zero out `wallet_balance` after migration.

**Function rewrites (all `SECURITY DEFINER`, `search_path=public`):**
- `accrue_mining_yields()` — credit `withdrawable_earnings` and `earnings_mining` (instead of `wallet_balance`). On runtime end, refund `locked_amount` to `mining_wallet` (unchanged).
- `search_exchange()` — credit `withdrawable_earnings` and `earnings_staking`.
- `add_daily_staking_earnings()` / `complete_expired_stakes()` — when a stake completes, move principal + remaining unpaid daily returns to `withdrawable_earnings` + `earnings_staking` (today principal isn't refunded anywhere — fixing as part of this work).
- `claim_mining_rewards()` (legacy) and `claim_miner_rewards()` — credit `withdrawable_earnings` + `earnings_mining`.
- `handle_deposit_approved_balance()` — drop the `main` branch. Only accept `target_wallet IN ('staking','mining','trading')`. Any deposit with `target_wallet='main'` is rejected by trigger with a clear error (and the deposit UI will no longer offer Main).
- `handle_deposit_approval()` (referral trigger) — rewritten per new referral logic (see §3).
- `transfer_between_wallets()` — drop `'main'` as a valid source/destination.
- `admin_adjust_balance()` / `admin_credit_reward()` — replace `'main'` with `'earnings'` keyword that writes to `withdrawable_earnings` + chosen breakdown bucket.
- `admin_process_withdrawal()` — on reject, refund into `withdrawable_earnings` instead of `wallet_balance`.

**New helper:** `get_withdrawable_balance(uid)` returns `withdrawable_earnings` minus pending withdrawals.

## 2. Referral system (new)

**Qualification:** A referee counts as a qualified staking referral once the sum of their approved deposits with `target_wallet='staking'` is ≥ $50.

**Rewards:** Two-part model.
- **Activation bonus:** On the referee's first qualifying staking deposit (the one that crosses the $50 cumulative threshold), pay the referrer **5%** of that deposit. Recorded in `referral_earnings` with new column `kind='activation'`.
- **Ongoing yield share:** Each time the referee earns staking yield (via `search_exchange` or daily cron), the referrer receives **1%** of that yield, credited to `withdrawable_earnings` + `earnings_referral`, and recorded in `referral_earnings` with `kind='yield_share'`.

**Schema changes:**
- `referral_earnings` add `kind TEXT NOT NULL DEFAULT 'legacy'` (existing rows backfilled to `'legacy'`, preserving history per user's choice).
- `referral_earnings` add nullable `stake_id UUID` for yield-share rows.

**Function changes:**
- Rewrite `handle_deposit_approval()`: only fire activation bonus when referee's cumulative approved staking deposits crosses $50 for the first time AND no prior activation row exists for that pair.
- Update `search_exchange()` and `complete_expired_stakes()` to insert yield-share rows + credit referrer.
- Rewrite `qualified_referrals_count()` to count by staking-target deposits only.
- `get_staking_referral_team()` returns `total_staking_deposits` and `qualified` based on the new rule.

## 3. Frontend changes

**`src/pages/Withdraw.tsx`** — restructure into 4 stacked sections:
- **A. Withdrawable Earnings** card with breakdown rows (Staking, Mining, Referral) summing to `withdrawable_earnings`. Single "Withdraw Earnings" button (10% fee, min from settings).
- **B. Trading Wallet Balance** card. Shows `trading_wallet`. "Withdraw Trading Balance" button (uses a new withdrawal_type `'trading'`; same 10% fee).
- **C. Locked Balance Overview** — strip the Trading row; keep Staking Locked + Mining Allocation only.
- **D. Stake Principal Status** — keep existing unlock countdown cards.

**`src/components/withdraw/LockedBalanceOverview.tsx`** — remove trading entry.

**`src/pages/Deposit.tsx`** — remove "Main Wallet" from the target wallet selector; default to Staking.

**`src/pages/Mining.tsx`** — add a clearer rental status block per active rental:
- Active allocation (USDT)
- Runtime remaining (countdown — exists)
- Allocation unlock countdown (same as runtime end) explicitly labeled
- After completion, show "Allocation Returned to Mining Wallet" badge on completed cards.
- Update copy: "Yields are credited to your Withdrawable Earnings."

**`src/pages/Dashboard.tsx`** and any KPI that reads `wallet_balance` — switch to `withdrawable_earnings`. Rename "Main Wallet" label everywhere to "Withdrawable Earnings".

**`src/components/StakingReferralTeam.tsx`** — show `total_staking_deposits` instead of `total_deposits`; update qualification badge copy.

**Admin pages** — update wallet dropdowns (`'main'` → `'earnings'`) in `admin/Users.tsx` and any reward-credit UI.

## 4. Withdrawal flow

- `withdrawals` table gains `source TEXT NOT NULL DEFAULT 'earnings'` (values: `'earnings'`, `'trading'`).
- On request:
  - `'earnings'` → debit `withdrawable_earnings` (and pro-rata the three breakdown counters).
  - `'trading'` → debit `trading_wallet`.
- On admin reject → refund into the original source.

## 5. Memory updates

After approval, update `mem://features/wallet-balance-system`, `mem://features/withdrawal-system`, `mem://ui/withdraw-page`, `mem://features/referral-program` to reflect the new model. Update `mem://index.md` Core line about wallet/withdrawal formulas.

## Out of scope / follow-ups

- Physically dropping the `wallet_balance` column (kept temporarily to make rollback safe).
- Migrating the historical 5%-per-deposit referral rows to the new schema (kept as `kind='legacy'`).
- Any redesign beyond what's needed for the new sections.
