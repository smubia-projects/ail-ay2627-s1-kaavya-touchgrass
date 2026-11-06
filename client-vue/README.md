# TouchGrass frontend

The app is Vue 3 + Vite. See the [root README](../README.md) for installation, environment setup and deployment.

## UI and data

- **Demo leaderboard** (`ExploreDemo.vue`): renders only the bundled `src/demo/leaderboard.json`, a fictional group's completed week. No API calls and no persistence. Regenerate the fixture from the repository root with `node scripts/generate-demo.cjs`; it uses the original ranking function offline.
- **Check a screenshot** (`ScreenshotCheckIn.vue`): local image selection and preview, then an explicit AI analysis that shows the extracted date, Social / Social Networking minutes and whether the day would count. Analyse only: nothing is saved, and the UI states that the screenshot goes to an AI provider and is not stored.
- **Activities** (`ActivitySuggestions.vue`): explicit AI generation with labelled built-in fallbacks and completion/undo. Stored in this browser under `ail-ay2627-s1-kaavya-touchgrass:activities`.
- **Diary** (`UserDiary.vue`): Monday-Sunday navigation, hours/minutes editing and a weekly average over logged days. Stored in this browser under `ail-ay2627-s1-kaavya-touchgrass:diary`.
- **Rate limits** (`api.js`, `RateLimitCTA.vue`): a 429 from the API opens the AI Lodge CTA modal using `queries_used` from the response; a 503 shows a "demo paused" notice instead.

## Vercel hosting

Root Directory `client-vue`, framework Vite, `npm ci`, `npm run build`, output `dist` (all in `vercel.json`). Set `VITE_API_BASE` to the Cloud Run URL, e.g. `https://ail-ay2627-s1-kaavya-touchgrass-464725632804.asia-southeast3.run.app`. No private values belong on Vercel.

## Checks

```sh
npm test
npm run build
```
