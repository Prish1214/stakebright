# stakebright

Build me a USDT Staking Website (BEP20 Network)
Core Features:
User Accounts & Wallets
Users can register/login with email and password.
Every Registered user can login back with their username and password .

In Deposit section user should be shown given QR image with this Address 0x652fdEab799Bd430038f010773CC340eAd9a6338 and mention that only support USDT bep20 with a copy option to copy Address 

At time of Deposits user must enter amount and transaction hash and after Deposit request will go in database table in admin supabase where amount, transaction hash and user name will be shown and when admin confirms deposit then admin will add user balance .

Staking Plans
Minimum Deposit: 25 USDT.
Lock period must be at least 30+ days.

Plans should look realistic with sustainable returns:
Plan A: 30 days lock → 1.5% daily return
Plan B: 60 days lock → 2% daily return
Plan C: 90 days lock → 2.5% daily return

Withdrawals
Allowed only for daily returns getting in particular stake showing in total earning where referral earning is also added and principal allowed to withdraw after staking period ends.

System should automatically apply a 10% withdrawal fee (configurable in admin).

Referral System
Each user gets a referral link.

Referrer earns 5% of referred user’s deposits.

Show referral earnings in dashboard separately.

User Dashboard: -
Wallet Balance (total USDT available).
Active Stakes (amount, plan, days left).
Earnings (daily + total earned).
Amount to withdraw (Daily earning+ refferal earning)

Staking Calculator (user enters amount → shows expected daily and total returns).

Referral Earnings tab.

Transaction History (deposits, staking, withdrawals, referral rewards, fees).

Clean modern UI with cards, “Stake More” button, and easy navigation.

Admin Panel in Supabase :-
View/manage all users, wallet balance,deposits, stakes, withdrawals, and referrals
Change staking % rates, fees, and referral % anytime.
Approve/reject withdrawals manually

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://stakebright.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b7f01019-9d71-4382-94fc-961a2ea3df11).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
