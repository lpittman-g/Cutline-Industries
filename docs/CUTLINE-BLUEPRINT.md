# Cutline Industries — Operating Blueprint

**Brand:** Cutline Industries  
**Domain:** cutline-industries.studio  
**North star:** Platform → terminal → ops → revenue

This blueprint is the single operating picture for product, growth, money, and systems.  
Cutline Industries is **not** a gaming YouTube channel brand.

---

## 1. Mission

Cutline Industries ships a platform (site, Mission Control, Creator OS terminal) and operator tools that turn media workflows into cashflow.

We do **not** compete with Google, AWS, Replit, or OpenAI. We **use** them as leverage.

---

## 2. Four pillars

| Pillar | Job | Primary modules |
|---|---|---|
| **Create** | Inbox VODs → cut → title → upload | Studio, Packs, Autopilot, Pipeline |
| **Grow** | Reach buyers + viewers | Outreach, Ads Lab, Media Kit, Blog |
| **Money** | Cash this week + YPP later | Money Now, Deals, Monetize, Stripe, AdSense |
| **Ops** | Run the machine daily | Command, Blueprint, Playbook, Analytics, Sprint 73 |

---

## 3. Current live stack (as of blueprint ship)

| System | Status | Notes |
|---|---|---|
| Creator OS (Amplify) | Partial | Staging Amplify OK; custom DNS may need Route 53 NS restore |
| Media Autopilot API | Optional | Present in repo; not the company identity |
| AdSense site tag | Wired | `ca-pub-8439504069928032` — needs slot ID + domain on Amplify |
| Deals / leads API | Live locally | Spark $750 · Surge $2500 · Eclipse $5000+ |
| Stripe pay links | Missing | Blocker for first cash |
| GitHub `main` | Broken remotely | Recreate `main`, push API + blueprint branches |

---

## 4. Phases

### Phase 0 — Foundation (done / almost done)
- [x] Brand + Creator OS shell
- [x] Google Analytics + AdSense client wiring
- [ ] Restore `cutline-industries.studio` → Amplify (see `docs/DOMAIN-CUTOVER.md`)
- [ ] Confirm `/terminal` on the live domain

### Phase 1 — Ship the platform (now)
1. Finish DNS cutover to Amplify
2. Smoke-test `/`, `/terminal`, `/app`
3. Keep optional media Autopilot off the public brand story

### Phase 2 — Money this week (parallel)
1. Stripe pay links: Spark $750 + Surge $2,500
2. 20 personalized outreaches / day from Outreach Engine
3. Media Kit + Deal Desk CTAs with pay links
4. AdSense: confirm site + `ads.txt` on production domain
5. Publish 2–3 Blog guides for search + display RPM

### Phase 3 — Distribution (30–90 days)
- Grow owned audience and site traffic
- Keep Stripe/sponsors as primary cash
- Treat social uploads as optional distribution, not the brand

### Phase 4 — Scale
- EC2/Lightsail Autopilot worker 24/7
- Discord community + comment bots
- Multi-surface distribution automation
- Agency mode: client seats / portals

---

## 5. Daily operating cadence

| Window | Action | Module |
|---|---|---|
| Morning | Autopilot / Studio ship Shorts | Autopilot, Studio |
| Midday | 10–20 outreaches | Outreach |
| Afternoon | Deal follow-ups + Media Kit sends | Deals, Media Kit |
| Evening | Pulse: views, replies, leads | Analytics, Blueprint |
| Weekly | Ads Lab creatives + Money Stack review | Ads, Monetize |

---

## 6. Content rules (always-on)

1. Hook in under 1 second  
2. Vertical 9:16 framing on the action  
3. Captions on  
4. Title under 70 chars, outcome-first  
5. 3–5 niche hashtags  
6. CTA after payoff  
7. Reply to first 10 comments in the first hour  

---

## 7. Offer ladder

| Package | Price | Promise |
|---|---|---|
| Spark Pack | $750 | 10 Shorts, titles/hooks, 72h, 1 revision |
| Surge Retainer | $2,500/mo | 40 Shorts/mo, weekly strategy, priority Autopilot |
| Eclipse Integration | $5,000+ | Sponsored longform + Shorts, CTA kit, usage rights |

Contact: `lpittman@cutline-industries.studio`

---

## 8. Success metrics

| Metric | 7-day target | 30-day target |
|---|---|---|
| Shorts published | 21+ | 90+ |
| Outreaches sent | 100+ | 400+ |
| Qualified replies | 5+ | 20+ |
| Cash closed (Stripe) | $750+ | $2,500+ |
| Site AdSense impressions | Tracking on | Growing WoW |
| Qualified site sessions | Tracking on | Growing WoW |

---

## 9. Next 7 actions (execute in order)

1. Point `cutline-industries.studio` DNS at Amplify  
2. Smoke-test `/terminal` → Command Center  
3. Create Stripe pay links for Spark + Surge  
4. Send 20 outreaches with Media Kit + pay link  
5. Confirm public brand copy is Cutline Industries (not a channel)  
6. Keep GitHub `main` green via SynthLang CI  
7. Add AdSense slot ID (`VITE_ADSENSE_SLOT`) and redeploy  

Live checklist UI: `/blueprint` in Creator OS.  
API: `GET /api/blueprint`
