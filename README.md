# SafVia — AI Car Companion (Phase 1 MVP)

A single-vehicle AI car companion app, formerly built under the working name "DriveIQ": symptom checker, garage-jargon translator, MOT/service reminders, and a diary. Built as a static site + one Netlify Function, so it costs almost nothing to run and takes about 10 minutes to deploy.

## Lead capture (name + email)

Before using any tool, a person is asked for their name and email once. This is stored in their browser so they're not asked again, and it's also submitted to **Netlify Forms** — a free, built-in Netlify feature that needs no extra setup. To see submissions: in Netlify, go to **Forms** in the left sidebar → click **"signup"** → you'll see every name/email as a spreadsheet-style list you can export as CSV. This is your starting database for the free tier; move to a proper database (Supabase) once you're validating Premium and need to log people in across devices.

## What's in Phase 1

- **AI Symptom Checker** — guided questions → likely fault(s) with confidence, safe-to-drive verdict, cost estimate, questions to ask a mechanic.
- **AI Garage Translator** — paste what a mechanic said, get plain English, urgency, and a fair UK price range.
- **My Garage** — store one vehicle: reg, model, year, mileage, MOT expiry, next service date.
- **Dashboard** — MOT/service countdown with colour-coded urgency.
- **Diary** — auto-logged history of every diagnosis and translation.

Works even without the AI backend connected (each tool falls back to a sensible offline answer), so you can deploy and demo it today, then switch on the AI key when ready.

## Brand system

- **Feel**: calm, premium, confident — Apple/Monzo/Notion/Tesla, not mechanic or petrolhead. No mascot.
- **Colours**: Navy `#0F172A` (trust), Electric Blue `#2563EB` (AI/innovation), Emerald `#10B981` (safe/success), Amber `#F59E0B` (needs attention), Red `#DC2626` (stop/critical), Off White `#F8FAFC` (background).
- **Type**: Manrope for headings, Inter for body copy, IBM Plex Mono for numbers (mileage, costs, valuations).
- **Logo**: minimal one-line wordmark with an S flowing into a winding road — no steering wheels, spanners, or car icons.
- **Voice**: never technical, never condescending — explain it the way you'd explain it to your favourite aunt. The AI backend is prompted to follow this directly, so diagnoses come back in plain English rather than jargon.

## Deploy in 10 minutes

1. **Get an Anthropic API key** at [console.anthropic.com](https://console.anthropic.com) (pay-as-you-go, no monthly minimum).
2. **Push this folder to a GitHub repo** (or drag-and-drop the folder straight into Netlify — no Git required for a first deploy).
3. **On [netlify.com](https://netlify.com)**: "Add new site" → deploy from the folder or repo. Netlify will detect `netlify.toml` automatically.
4. **Add the environment variable**: Site settings → Environment variables → add `ANTHROPIC_API_KEY` with your key.
5. **Redeploy** — the AI features go live immediately. Total cost: free Netlify tier + roughly £5–£20/month in Anthropic API usage at low volume.

## Suggested pricing (from the original plan)

- **Free** — 1 vehicle, basic diary, 3 AI diagnoses/month, MOT & service reminders.
- **Premium £4.99–£5.99/mo** — unlimited AI diagnoses, garage translator, dashboard scanner, receipt scanner.
- **Pro £7.99–£9.99/mo** — multiple vehicles, voice input, sound diagnosis, finance/PCP tracking, resale assistant.

## Roadmap — what to build next, in order

**Phase 1 (this build, 4–8 weeks of polish)**
Symptom checker, one vehicle, MOT/service reminders, diary, dashboard. Ship this, get real users, see what they actually use.

**Phase 2 — add usage-driven revenue**
- Dashboard warning-light photo scanner (upload photo → AI identifies each light + severity)
- Receipt scanner (photo → auto-logged service history)
- Garage translator refinements from real user quotes
- Vehicle valuation (AI market estimate)
- Stripe subscription billing (Premium tier)

**Phase 3 — retention & stickiness**
- Multiple vehicles / family garage
- Voice input for the symptom checker
- Sound-based diagnosis (upload a recording of a knock/squeal/grind)
- Finance tracker (PCP/HP balance, balloon payment, settlement estimate)
- Insurance renewal reminders

**Phase 4 — the "super app" / affiliate layer**
- MOT and service booking integrations
- Insurance and breakdown-cover comparison (affiliate revenue)
- Tyre and battery ordering (affiliate revenue)
- AI resale assistant (auto-generate AutoTrader/Facebook/eBay listings)
- SEO landing pages per symptom ("car won't start", "grinding brakes", etc.) to drive free organic traffic into the free tier

## Notes on this build

Form detection enabled.
- No framework, no build step — plain HTML/CSS/JS, so it deploys anywhere static hosting works (Netlify, Vercel, Cloudflare Pages).
- Vehicle and diary data are stored in the browser's `localStorage` for Phase 1 — fine for a single-device MVP, but plan to move to Supabase (same stack as your other apps) once you add accounts, multi-device sync, or Stripe billing in Phase 2.
- The AI function has an offline fallback built in on purpose, so the demo never looks broken to an investor or early user even before the API key is wired up.
