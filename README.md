# TouchGrass

A hackathon project by Kaavya Manikandan that turns reducing social media use into a friendly group challenge, with personal reflection and ideas for life beyond the screen.

**AI Lodge showcase version.** This repository is the SMU BIA AI Lodge deployment of TouchGrass: a public, no-login demo. The original app had accounts, invite-code groups and a MongoDB-backed live leaderboard. For the showcase those are replaced by a fictional sample leaderboard, and the AI features run without storing anything.

- **Website:** https://ail-ay2627-s1-kaavya-touchgrass.vercel.app
- **API health:** https://ail-ay2627-s1-kaavya-touchgrass-464725632804.asia-southeast3.run.app/api/health
- **Original repository:** [github.com/kaavya134/touchgrass](https://github.com/kaavya134/touchgrass)

## 1. Problem Statement

Doomscrolling can turn a quick social media check into much more time on a phone than intended. Recognising that habit does not automatically make it easy to change: a screen-time number alone offers little motivation, and putting the phone down can leave the question of what to do instead.

I experienced this myself and wanted an incentive to put my phone down. TouchGrass grew from that personal problem: make reducing social media usage a shared challenge with friends, add accountability through daily check-ins, and offer small alternatives to scrolling. The project does not claim a measured reduction in usage or invent statistics about its impact.

## 2. Solution Overview

TouchGrass combines four things in one place. In this showcase:

- **Demo leaderboard:** a fictional group's completed Monday-Sunday week, ranked with the app's real ranking function (lower weekly social usage wins; the highest total owes a custom forfeit).
- **Check a screenshot:** upload a daily screen-time screenshot and AI extracts the date and the **Social / Social Networking** minutes, exactly as a real check-in would. Analyse only: nothing is saved.
- **Offline activity suggestions:** choose interests, available time, company and setting to get three activities that fit a short break.
- **Personal diary:** manually log total phone usage and reflect on what encouraged scrolling or helped you disconnect, saved in your browser.

**Privacy:** screenshots are sent to an AI provider (through OpenRouter) for analysis and are not stored or logged by TouchGrass. Diary entries and activities stay in your browser.

## 3. Key Features

### Screenshot check

- Choose a PNG, JPEG or WebP screenshot (up to 5 MB), preview it, then click **Analyse screenshot**. Selecting a file alone never calls AI.
- The model reads only the daily Social / Social Networking category; total phone usage, weekly totals and app limits are not substitutes.
- The result shows the extracted date (Asia/Singapore), the minutes and whether the day would count: today is provisional, yesterday is a completed day.

### Demo leaderboard

The bundled fixture (`client-vue/src/demo/leaderboard.json`) is generated offline from `scripts/demo-data.cjs` with the original ranking code in `server/leaderboard.js`: Monday-Sunday weeks, completed days only, missing days never zero, shared ranks on ties, and no single loser on a tied highest total. Regenerate it with `node scripts/generate-demo.cjs`.

### Diary and activities

- The diary has a Monday-Sunday strip, week navigation, hours/minutes inputs, a weekly bar chart and reflection prompts. Weekly averages include only logged days.
- Activities offer Outdoors, Fitness, Creative, Relaxing and Social interests; 10/20/30/60-minute budgets; Solo / With friends; Indoors / Outdoors. Three cards come with first steps and completion toggles. If AI is unavailable or rate-limited, clearly labelled **built-in suggestions (not AI-generated)** are offered.

## 4. AI Integration

The backend calls **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`) with the model in `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`, the model the extraction prompt was tuned for; the original submission used it through APIyi). Both calls request `response_format: json_object` and are validated server-side.

```text
Screenshot -> Analyse -> API validates the data URL -> rate limiter (bucket "vision")
  -> OpenRouter vision model returns {date, socialMediaMinutes, notes}
  -> API validates the JSON and returns it; nothing is stored

Preferences -> Suggest -> API validates the allowlisted preferences -> rate limiter (bucket "activities")
  -> OpenRouter returns three activities -> API checks them against the preferences
```

The extraction prompt supplies a Singapore reference date, asks for daily Social-category usage only, tells the model to treat screenshot text as data rather than instructions, and requests null for unclear values. The activity validator requires exactly three distinct titles, bounded text, matching category/company/location and whole-minute durations within the budget. This uses an existing pretrained model; nothing was trained or fine-tuned.

## 5. External Tools & Datasets

| Technology/service | Role |
| --- | --- |
| Vue 3, Vite, Axios, Bootstrap, Lucide | Frontend |
| Node.js 24, Express 5, cors | Stateless API |
| OpenRouter | Vision and text model access |
| Upstash Redis + the AI Lodge shared rate-limit engine | Per-IP limits on the two AI routes |
| Vercel / Google Cloud Run | Frontend / API hosting |
| ChatGPT / Codex | Development assistance for the original submission |

No external dataset is used. The demo fixture and test inputs are fictional.

## 6. Installation & Setup

Requires **Node.js 24.x** and npm.

```sh
npm ci --prefix server
npm ci --prefix client-vue
cp server/.env.example server/.env          # then fill OPENROUTER_API_KEY
cp client-vue/.env.example client-vue/.env  # VITE_API_BASE=http://localhost:8080
npm run dev --prefix server                 # API on http://localhost:8080 (GET /api/health)
npm run dev --prefix client-vue             # app on http://localhost:5173
```

Without Upstash credentials the rate limiter is disabled, which is what local development wants. Every variable is documented in [server/.env.example](server/.env.example) and [client-vue/.env.example](client-vue/.env.example).

Tests and build:

```sh
npm test --prefix server
npm test --prefix client-vue
npm run build --prefix client-vue
```

`server/test-screenshot-live.js` is an opt-in script that sends a real screenshot to the provider and may incur cost; it is not part of `npm test` or the Docker image.

### Deployment (AI Lodge stack)

- **API → Cloud Run:** `.github/workflows/deploy.yml` builds `server/` (Dockerfile, `node:24-slim`) on every push to `master`, pushes the image to Docker Hub and deploys service `ail-ay2627-s1-kaavya-touchgrass` in `asia-southeast3`. Runtime env comes from the `DOTENV` repo secret (`gh secret set DOTENV < server/.env`): `CORS_ORIGINS`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and optionally `RATE_LIMIT_VISION_MAX`, `RATE_LIMIT_ACTIVITIES_MAX`, `RATE_LIMIT_WINDOW_SECONDS`.
- **Frontend → Vercel:** Root Directory `client-vue` (build settings in `vercel.json`), env `VITE_API_BASE` = the Cloud Run URL.
- **Rate limits:** buckets `vision` and `activities` for project `ail-ay2627-s1-kaavya-touchgrass` (default 5 per IP per 5 days until the central sheet overrides them). A 429 shows the AI Lodge CTA; a 503 means the demo was paused by the kill switch.

## 7. AI Safety & Limitations

- AI can misread text, dates, category values or layout. A successful JSON response is not proof that its contents are true.
- **Screenshot-backed does not mean authenticity verified.** An edited screenshot can look legitimate to the model.
- Clicking Analyse sends the screenshot to a third-party AI provider; avoid images that show other personal information. TouchGrass never logs or stores the image or the result; provider retention is outside this repository's control.
- The API validates the data-URL format, a 7 MiB JSON-body limit (16 KiB on other routes), real calendar dates and integer minutes from 0 to 1,440. Provider requests time out after 60 seconds.
- AI routes are limited per IP by the shared AI Lodge engine; the demo, diary and built-in suggestions keep working when the limit is reached.
- The diary and activities live in this browser only: no sync, no encryption, and clearing browser data removes them.
- The group competition itself (accounts, invites, live rankings) is not part of this showcase; the leaderboard is fictional sample data.
