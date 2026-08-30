# The Push-Up Challenge

A tiny, no-dependencies web app for running a group push-up challenge (~15 people).
Everything runs in the browser and is saved to `localStorage` — no server, no build step.

## Features

- Add up to ~15 participants
- Log sets per person (manual count, quick-add buttons, back-date a set)
- Leaderboard ranked by total reps, with "today" and streak info
- Team goal with progress bar — team total, per-person total, or per-person-per-day
- 30-day activity chart (per person or everyone)
- Recent activity feed with delete
- Export / import the whole challenge as JSON to move between devices

## Run locally

Just open `index.html` in a browser. Or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Data

State is stored under the `pushup-challenge:v1` key in `localStorage`, scoped to the
browser and origin you use. Use **Export JSON** to back it up or carry it to another
device, and **Import JSON** to restore it.

## Roadmap

- Publish to GitHub Pages
- Optional shared backend so each person can log from their own device
