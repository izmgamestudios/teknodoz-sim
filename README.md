# Teknodoz Simulation

Persona-based simulation studio built on [MatrAIx](https://github.com/MatrAIx-ai/MatrAIx-Persona-8B) (MIT).
React + TypeScript + Tailwind frontend, dependency-free Node server (`server.mjs`, `server/`).

## Features
- Persona explorer: 200 MatrAIx sample personas + 1,200 synthetic country-based personas (50 countries), region/subregion/country filters, bulk selection
- Study builder: survey (5-10 questions), website URL (page text), App Store link, product description; question import (JSON/CSV/lines)
- Runs MatrAIx from the admin UI (quick test or real run), live log, per-question results
- 4 languages (tr/en/de/es), dark/light theme, guide with screenshots and example studies

## Run
```bash
npm ci && npm run build
cp .env.example .env      # set ADMIN_EMAIL, ADMIN_PASSWORD_HASH (node scripts/hash-password.mjs), SESSION_SECRET
node server.mjs           # serves dist/ and /api on $PORT (default 3000)
```
Development: `npm run dev` (Vite proxies `/api` to port 3000). MatrAIx is installed from the Admin page, or `scripts/setup-matraix.sh`.

## Checks
```bash
npx tsc --noEmit -p .
node scripts/test-personagen.mjs && node scripts/test-countries.mjs && node scripts/test-safefetch.mjs && node scripts/test-studies.mjs
node --experimental-strip-types scripts/test-importers.mjs
python3 -I scripts/validate-survey-task.py custom-tasks/*/
```

## Data and limits
- Country data: `shared/countries.json` is an **approximate baseline**; Admin > Country data refreshes it from the World Bank (CC BY 4.0).
- Personas are synthetic. Life stage, economic motivation and risk tolerance are heuristic mappings, not measured country data.
- Website/store inputs read text only. No APK analysis, no live browser walk-through yet.
- Generators: `scripts/build-custom-tasks.py` (custom MatrAIx tasks), `scripts/build-country-personas.mjs`, `scripts/make-guide-shots.cjs` (guide screenshots).
