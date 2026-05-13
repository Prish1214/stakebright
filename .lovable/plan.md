## Overview

Build a multi-wallet system with manual transfers, plus rebuild Mining around purchasable miners and add a new AI Trading Bot page. This is a large change touching the database, multiple pages, and adding new components.

## 1. Database Changes (single migration)

**Add wallet columns to `profiles`:**
- `staking_wallet` numeric default 0
- `mining_wallet` numeric default 0
- `trading_wallet` numeric default 0
- (`wallet_balance` stays as the Main Wallet)

**New table `wallet_transfers`** — id, user_id, from_wallet, to_wallet, amount, created_at. RLS: users select/insert own.

**New table `user_miners`** — id, user_id, miner_type (BTC/LTC/DOGE), miner_tier, hashrate, efficiency, lifespan_days, price, purchased_at, expires_at, last_started_at, mining_ends_at, is_mining, total_mined. RLS: users select/insert/update own.

**New table `trading_sessions`** — id, user_id, started_at, ends_at, profit, status, trades_json. RLS: users own.

**New RPCs:**
- `transfer_between_wallets(from_wallet text, to_wallet text, amount numeric)` — validates balance, atomic update.
- `purchase_miner(miner_type text, tier text)` — deducts from mining_wallet, inserts user_miners row.
- `start_miner(miner_id uuid)` — 24h cycle per miner.
- `claim_miner_rewards(miner_id uuid)` — credits mining_wallet with variable amount based on miner.
- `start_trading_session()` — requires trading_wallet > 0, 24h cycle.
- `claim_trading_session()` — applies variable PnL to trading_wallet.

**Modify existing RPCs:**
- Staking creation must deduct from `staking_wallet` (not main `wallet_balance`).
- Old `start_cloud_mining` / `claim_mining_rewards` deprecated (replaced by per-miner flow).

## 2. Frontend

**New shared `WalletTransferModal` component:**
- Source + destination wallet selector, amount input, animated balance ticker, recent transfers list.
- Used from Dashboard, Staking, Mining, Trading pages.

**Dashboard updates:**
- 4 wallet cards (Main / Staking / Mining / Trading) with neon styling, "Transfer" button on each.
- Total staked summary kept.

**Staking page:**
- Reads `staking_wallet` for available balance instead of main.
- Shows "Transfer to Staking Wallet" CTA when insufficient.

**Mining page (rebuild):**
- Catalog of miners: BTC / LTC / DOGE, each with 3 tiers (Basic/Pro/Elite) showing hashrate, efficiency, lifespan, price, est. daily return range.
- Purchase with mining_wallet.
- "My Miners" grid: each miner card has 24h countdown, Start/Claim button, glowing rig animation, progress circle.
- Variable rewards (random within range stored on miner).

**New Trading page (`/trading`):**
- Live-feel BTC/ETH/SOL candlestick charts (lightweight-charts or custom SVG with simulated ticks).
- "Activate Auto Trade" button (24h cooldown via `trading_sessions`).
- During active session: AI scanning animation, scalping trade cards animating in, profit counter ticking up, win-rate gauge, market sentiment indicator.
- Past sessions history with PnL.
- Variable returns computed server-side at claim.

**Routing & nav:** Add `/trading` route + sidebar link; keep `/mining`.

## 3. Behavior rules enforced

- Staking → only `staking_wallet`
- Mining purchase + rewards → only `mining_wallet`
- Trading → only `trading_wallet`
- All wallets fed by manual transfers from Main Wallet (and back).
- Withdrawals continue to come from earnings/principal as today (Main Wallet path unchanged).

## Technical notes

- Lightweight charts: use `lightweight-charts` npm package for realistic candles.
- Variable returns: server-side `random()` within sane bounds per miner tier / trading volatility tier.
- All balance mutations go through SECURITY DEFINER RPCs with row locks (`FOR UPDATE`) to prevent race conditions.
- Reuse `CyberCard`, `NeonButton`, `AnimatedNumber`, `GlowingIcon` for consistent neon theme.

## Approval needed

Database migration must be approved before I can wire frontend to the new tables/RPCs. Shall I proceed with the migration?
