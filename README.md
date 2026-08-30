# The Push-Up Challenge

A tiny, no-dependencies web app for running a **365-day** group push-up challenge
(~15 people) that gets harder every week. Everything runs in the browser and is
saved to `localStorage` — no server, no build step.

## Features

- **Sticky mission banner** — current day (`Day 42 of 365`), days-left countdown,
  a year progress bar, and this week's mission (push-ups per person, per day)
- **Weekly progression** — Week 1 target + a fixed weekly increase, so every new
  week asks for more. Configurable in **Settings**.
- **Leaderboard** ranked by total reps, showing each person's `today / target`
  and a ✓ when they've hit today's number, plus day-streak
- **Team stats** — total reps, participants, reps today, and how many people are
  on target today
- **Today's team progress** bar — team reps today vs `target × participants`
- **30-day activity chart** with a dashed target line, filterable to one person
  or everyone
- Add / remove participants; recent-activity feed with delete
- **Export / Import JSON** to move the whole challenge between devices

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Setting up the challenge

Click **Settings** and set:

- **Challenge start date** — this is Day 1
- **Week 1 target** — push-ups per person, per day, in the first week
- **Weekly increase** — reps/day added at the start of each new week

Example: start `20`/day, `+5`/week → Week 2 is `25`/day, Week 13 is `80`/day,
Week 52 is `275`/day. The preview in the dialog shows the ramp.

## Data

State is stored under the `pushup-challenge:v1` key in `localStorage`, scoped to
the browser and origin you use. Use **Export JSON** to back it up or carry it to
another device, and **Import JSON** to restore it.

## Roadmap

- Publish to GitHub Pages
- Optional shared backend so each person can log from their own device
