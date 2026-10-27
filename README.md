# workout-app

A small phone web app to read workout plans and append entries to a workout log. The app stores the data in a private GitHub repo.

The app contains no data. It reads and writes the private repo through the GitHub API. It uses a fine-grained token that you store on the device.

## Setup

1. Create a fine-grained token: GitHub → Settings → Developer settings → Fine-grained tokens.
   - Repository access: only the data repo.
   - Permissions: Contents → Read and write.
2. Open the app on the phone and paste the token under ⚙︎.
3. Add the page to the home screen.

## Plan files

Each workout has 2 files in the plan folder:

- `navn.txt` — the guide. One block per exercise (`1. NAVN`, then `Vægt:`, `Sæt:`, `Reserve:`, `Pause:`, `Noter:`, `Mål:`, `Næste:`). The log form shows `Mål`, `Reserve` and `Noter` on each exercise card.
- `navn.log.txt` — the start values for the log form. One block per exercise: `1. NAVN`, `Pause: 3 min`, one line per set (`30 kg × 4`, `Kropsvægt × 5`, `Advanced tuck 6 sek.`, with `V`/`H` in front for one side), `Note:`.

The app writes log entries in the same format as `navn.log.txt`. Each entry starts with a `═══` line, so you can see where a workout starts.

## Food (Kost)

The **Kost** tab saves a meal: photos, a note and an optional morning weight. The app scales photos to max 1600 px JPEG before upload. It writes to a day folder in the data repo:

```
Kost/kost.log/2026-10-27/1235.jpg
Kost/kost.log/2026-10-27/1235.2.jpg   (2nd photo of the same meal)
Kost/kost.log/2026-10-27/1235.txt     (date, time, photo names, weight, note)
```

A second meal in the same minute gets `1235-2`.

## Files

- `core.js` — GitHub client, plan parsing and log formatting (no DOM).
- `app.js` — UI.
- `test.mjs` — tests for `core.js` (`node test.mjs`).
