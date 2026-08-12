# Cutline Industries — Operating Blueprint

**Brand:** Cutline Industries  
**Domain:** cutline-industries.studio  
**Channel:** Lamont Pittman (`@lamontpittman-f4q`) → rename target: Cutline Industries  
**North star:** Gaming VOD → Shorts factory → audience → cash (Stripe first, YPP second)

This blueprint is the single operating picture for content, growth, money, and systems.

---

## 1. Mission

Cutline turns gameplay VODs into a daily Shorts machine, a sponsor-ready media brand, and cashflow — without waiting on YouTube Partner Program alone.

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
| YouTube OAuth + Autopilot API | **Live** | Refresh token saved; channel readable |
| YouTube channel | **Live** | `UC-aJkWw9BBXutlxITXcNdRw` · 0 videos |
| Creator OS (Amplify) | Partial | Staging Amplify OK; custom DNS may need Route 53 NS restore |
| AdSense site tag | Wired | `ca-pub-8439504069928032` — needs slot ID + domain on Amplify |
| Deals / leads API | Live locally | Spark $750 · Surge $2500 · Eclipse $5000+ |
| Stripe pay links | Missing | Blocker for first cash |
| GitHub `main` | Broken remotely | Recreate `main`, push API + blueprint branches |

---

## 4. Phases

### Phase 0 — Foundation (done / almost done)
- [x] Brand + Creator OS shell
- [x] Google Analytics + AdSense client wiring
- [x] YouTube Data API + OAuth refresh token
- [x] Channel created on Workspace account
- [ ] Rename channel → **Cutline Industries**
- [ ] Restore `cutline-industries.studio` → Amplify (Route 53 NS) — domain currently on Squarespace DNS + private template store; Commerce API wired (`docs/SQUARESPACE.md`)
- [ ] Recreate GitHub `main` + open PRs

### Phase 1 — Ship content daily (now)
1. Drop VODs in `inbox/`
2. Set `CUTLINE_DRY_RUN=0` when ready for real uploads
3. Run `npm run autopilot` (or Autopilot page → run once)
4. Cadence: **3–10 Shorts / day**, private first 24h, then public
5. Same-day cross-post TikTok + Reels when capacity allows

### Phase 2 — Money this week (parallel)
1. Stripe pay links: Spark $750 + Surge $2,500
2. 20 personalized outreaches / day from Outreach Engine
3. Media Kit + Deal Desk CTAs with pay links
4. AdSense: confirm site + `ads.txt` on production domain
5. Publish 2–3 Blog guides for search + display RPM

### Phase 3 — YPP track (30–90 days)
- Shorts views + subs toward Partner thresholds
- Enable ads, memberships, Super Thanks, Shopping when eligible
- Keep Stripe/sponsors as primary cash until YPP stabilizes

### Phase 4 — Scale
- EC2/Lightsail Autopilot worker 24/7
- Discord community + comment bots
- Multi-channel cross-post automation
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
5. 3–5 niche hashtags + `#GamingShorts`  
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
| Channel subs | 50+ | 500+ |

---

## 9. Next 7 actions (execute in order)

1. Rename YouTube channel → Cutline Industries  
2. Drop first VOD in `inbox/` and run Autopilot once (private)  
3. Create Stripe pay links for Spark + Surge  
4. Send 20 outreaches with Media Kit + pay link  
5. Fix DNS so studio domain hits Amplify  
6. Push blueprint + API branches; restore GitHub `main`  
7. Add AdSense slot ID (`VITE_ADSENSE_SLOT`) and redeploy  

Live checklist UI: `/blueprint` in Creator OS.  
API: `GET /api/blueprint`
