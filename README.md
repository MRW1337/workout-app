# workout-app

A small phone web app to read workout plans and append entries to a workout log. The app stores the data in a private GitHub repo.

The app contains no data. It reads and writes the private repo through the GitHub API. It uses a fine-grained token that you store on the device.

## Setup

1. Create a fine-grained token: GitHub → Settings → Developer settings → Fine-grained tokens.
   - Repository access: only the data repo.
   - Permissions: Contents → Read and write.
2. Open the app on the phone and paste the token under ⚙︎.
3. Add the page to the home screen.

## Files

- `core.js` — GitHub client and log formatting (no DOM).
- `app.js` — UI.
- `test.mjs` — tests for `core.js` (`node test.mjs`).
