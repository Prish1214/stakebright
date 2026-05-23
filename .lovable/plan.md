
# Admin Panel Build Plan

A premium dark fintech admin panel mounted at `/admin/*`, gated by the existing `app_role = 'admin'` check (`has_role()` RPC). All pages use the same shared layout with collapsible sidebar, top bar, and animated cards consistent with the existing cyberpunk neon theme.

## Access & routing

- New route group `/admin` protected by an `AdminGuard` that calls `has_role(auth.uid(), 'admin')`. Non-admins redirected to `/dashboard`.
- Routes:
  - `/admin` — Dashboard
  - `/admin/users` — User Management
  - `/admin/deposits` — Deposits
  - `/admin/withdrawals` — Withdrawals
  - `/admin/staking` — Staking Management
  - `/admin/trading` — AI Trading Management
  - `/admin/mining` — Mining Management
  - `/admin/referrals` — Referral Analytics
  - `/admin/analytics` — Charts & Analytics
  - `/admin/controls` — Reward/Announcement/Section controls
  - `/admin/security` — Activity logs, IP tracking, webhook logs

## Pages

### 1. Dashboard (`/admin`)
KPI cards (animated counters): total users, active users (logged in 7d), total deposits ($), total withdrawals ($), total locked funds (active stakes + mining rentals), total withdrawable balance, active staking users, active AI trading users (used scalp in 24h), active mining allocations, pending withdrawals count. Plus a live activity feed (recent deposits/withdrawals/stakes/scalps) auto-refreshing every 15s.

### 2. User Management (`/admin/users`)
Searchable, filterable table of all profiles. Columns: email, username, wallet balances (main/staking/mining/trading), total deposits, total withdrawals, qualified referrals, active stake count, AI level, last activity. Row actions: freeze/unfreeze, edit balances, edit notes. Edit balance opens a modal calling a new `admin_adjust_balance()` RPC. Freeze toggles a new `is_frozen` flag on profile.

### 3. Deposits (`/admin/deposits`)
Table of all deposits with filter by status / network (bep20/trc20) / target wallet. Suspicious indicators: duplicate tx hash, amount mismatch, multi-user same tx. Approve/reject buttons (already credited via trigger; admin can mark approved/rejected with note).

### 4. Withdrawals (`/admin/withdrawals`)
Table of all withdrawals with status filter, approve/reject actions calling a new `admin_process_withdrawal()` RPC. On approve: status → completed, on reject: refund net+fee back to source wallet.

### 5. Staking Management (`/admin/staking`)
Active stakes table, upcoming unlocks (next 7/30 days, sum), total staking liability (sum of remaining payouts), per-plan analytics chart (active count, locked, paid out).

### 6. AI Trading Management (`/admin/trading`)
Daily bot activations (24h count), level distribution chart (L1..L6), total rewards distributed, line chart of daily profits.

### 7. Mining Management (`/admin/mining`)
Active mining allocations table, coin usage pie (BTC/LTC/DOGE), runtime expiries (next 7 days), total mining reward exposure (sum of max possible remaining yields).

### 8. Referral Analytics (`/admin/referrals`)
Top 20 referrers by qualified referrals & by earnings, active referral graph by day, suspicious detection: same-IP signups (when IP available), zero-deposit referees, signups in rapid succession.

### 9. Analytics (`/admin/analytics`)
Daily growth (signups/day), deposits vs withdrawals stacked, revenue/liability chart, engagement (active users / day) — using recharts.

### 10. Admin Controls (`/admin/controls`)
- Reward ranges: edit min/max for staking plans and mining tiers and AI levels (stored in `system_settings` as JSON for AI/mining; staking already in `staking_plans`).
- Announcements/banners: CRUD on new `announcements` table (title, body, type, active, starts_at, ends_at).
- Manual reward: credit any wallet of a user with note.
- Section freeze toggles: stored in `system_settings` (`freeze_staking`, `freeze_mining`, `freeze_trading`, `freeze_withdrawals`). Frontend pages read these and disable actions when frozen.

### 11. Security (`/admin/security`)
- `admin_activity_logs` table view (every admin action logged).
- Login/IP tracking: new `login_events` table (best-effort via client capture on auth).
- Webhook/payment logs: surface `nowpayments-webhook` edge function logs link + recent deposits with payment metadata.
- Suspicious activity feed (large withdrawals, duplicate tx, rapid signups).

## Database changes (single migration)

```sql
-- profile flags
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_notes text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_ip text;

-- announcements
CREATE TABLE announcements (id, title, body, type, is_active, starts_at, ends_at, created_by, created_at);

-- admin activity logs
CREATE TABLE admin_activity_logs (id, admin_id, action, target_type, target_id, metadata jsonb, created_at);

-- login events
CREATE TABLE login_events (id, user_id, ip, user_agent, created_at);

-- RLS: admins ALL, users SELECT own (login_events), public SELECT active announcements
```

RPCs (SECURITY DEFINER, admin-only via `has_role` check):
- `admin_adjust_balance(p_user_id, p_wallet, p_delta, p_note)`
- `admin_process_withdrawal(p_id, p_action, p_note)` — approve/reject with refund
- `admin_update_deposit_status(p_id, p_status, p_note)`
- `admin_credit_reward(p_user_id, p_wallet, p_amount, p_note)`
- `admin_set_setting(p_key, p_value)`
- `log_login_event(p_ip, p_ua)` — callable by any authenticated user, updates `last_login_*` + inserts row
- `admin_stats()` — returns JSON with all dashboard KPIs in one round-trip

## Frontend additions

- `src/components/admin/AdminLayout.tsx` (sidebar + topbar, dark fintech)
- `src/components/admin/AdminGuard.tsx`
- `src/components/admin/KpiCard.tsx`, `ActivityFeed.tsx`, `DataTable.tsx`
- `src/pages/admin/Dashboard.tsx` + the 10 other pages above
- Sidebar link "Admin Panel" appears only for admins (gated via `useAuth` + role check)
- Charts via existing `recharts` dep

## Design

Dark `#0a0e1a` base with neon cyan/violet accents, glassmorphism cards, subtle grid, soft glow on KPIs, smooth fade/slide animations, premium exchange feel (Binance/Bybit-inspired layout density).

## Out of scope / notes

- IP capture is best-effort from client (no server middleware available in SPA); a more accurate version would require an edge function. We'll add a `log_login_event` RPC called from `useAuth` after sign-in.
- Suspicious referral detection is heuristic-based on data we already have.
