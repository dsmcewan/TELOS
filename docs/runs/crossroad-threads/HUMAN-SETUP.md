# Crossroad Threads — One-Time Human Setup Checklist

The ONLY stage of the advertising launch a human executes. Everything before it
(certified strategy) and after it (campaign provisioning, daily ops, weekly
review) is agent-operated. Order matters — later items depend on earlier ones.

## A. Meta (the paid channel — everything below is required)

1. **Business Manager**: create at business.facebook.com (use the brand email).
   Complete business verification when prompted (legal name, address; this can
   take days — start it first).
2. **Ad account**: create inside Business Manager; set currency and time zone
   carefully (immutable); add the payment method. Keep the daily account
   spending limit at $20 until the ops loop earns trust.
3. **Facebook Page + Instagram account**: create the Crossroad Threads page and
   IG profile, connect both to Business Manager (ads run from these identities).
4. **Domain** (depends on Phase-2 launch build going live): add the own domain
   in Brand Safety -> Domains and verify via DNS TXT record.
5. **Pixel + Conversions API**: Events Manager -> create Pixel (name:
   `crossroad-web`). Generate a **Conversions API token** from the pixel
   settings. Record: `META_PIXEL_ID`, `META_CAPI_TOKEN`.
6. **System user + token (hands the keys to the agents)**: Business Settings ->
   System Users -> create `crossroad-ads-agent` (admin NOT required — employee +
   assigned ad account with Manage permission). Generate a token with scopes
   `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`.
   Set it on the machine as env `META_ACCESS_TOKEN`, plus `META_AD_ACCOUNT_ID`
   (the `act_...` id) and `META_PAGE_ID`:
   `setx META_ACCESS_TOKEN "..."` / `setx META_AD_ACCOUNT_ID "act_..."` / `setx META_PAGE_ID "..."`

## B. Organic handles ($0 distribution — create, don't fund)

7. TikTok business account, Pinterest business account, X account — matching
   handle (`@crossroadthreads` or nearest available). No ad accounts, no
   payment methods on these yet: paid expansion is gated on the Meta signal
   review in the certified plan.

## C. Authorization boundaries you are agreeing to

- Agents will create campaigns/ad sets/ads **in PAUSED state only**. Nothing
  spends until you flip campaigns live in Ads Manager — that click is the spend
  authorization.
- Once live, agents adjust budgets **only within the certified bounds** (per-day
  cap and monthly cap from `ADVERTISING.md`, $250–500/mo test phase). Any action
  outside bounds halts the ops pass with a `needs-human` flag instead of acting.
- Every agent decision is appended to a signed ledger with the metrics snapshot
  and the certified rule that fired — auditable at any time.
- Revocation: delete the system-user token (Business Settings) to instantly
  de-authorize all agent operations.

## D. Done when

- [ ] Business verified, ad account live with payment method
- [ ] Page + IG connected
- [ ] Domain verified (post Phase-2 launch)
- [ ] `META_PIXEL_ID`, `META_CAPI_TOKEN` recorded
- [ ] `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID` set in env
- [ ] Organic handles created
