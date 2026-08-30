# The Push-Up Challenge

A tiny, no-dependencies web app for running a **365-day** group push-up challenge
(~15 people) that gets harder every week. Everything runs in the browser and is
saved to `localStorage` — no server, no build step.

## Features

- **Mission banner** — current day (`Day 42 of 365`), days-left countdown, a year
  progress bar, and this week's mission (push-ups per person, per day)
- **Weekly progression** — Week 1 target + a fixed weekly increase, so every new
  week asks for more. Configurable in **Settings**.
- **Check-in grid** — participants down the left, calendar days across the top.
  Tap a cell to mark the day you completed your push-ups. **Sundays are rest
  days** and stay blocked out. Month navigation, a "days completed this month"
  count per row, and it auto-scrolls to today. Hitting the day's rep target
  auto-checks that day.
- **Leaderboard** ranked by total reps, showing `done today`, `reps / target`,
  and a check-in streak (🔥) that carries across Sundays
- **Team stats** — total reps, participants, reps today, checked in today
- **Today's team progress** bar — team reps today vs `target × participants`
- **30-day activity chart** with a dashed target line, filterable to one person
  or everyone
- **Motivation hero** image at the top (see below)
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

## Motivation image

One file — `assets/warrior.jpg` — is used in two places:

1. the **header hero** image, and
2. a **faint watermark** fixed over the whole app.

Drop your image in at that path (JPG, or update the `src` in `index.html` and the
`url()` in `styles.css` for another name). If the file is missing the app just
hides the hero frame and the watermark — everything else works normally.
Tune the watermark strength via `opacity` in the `body::after` rule in
`styles.css` (currently `0.05`).

## Data

State is stored under the `pushup-challenge:v1` key in `localStorage`, scoped to
the browser and origin you use. Use **Export JSON** to back it up or carry it to
another device, and **Import JSON** to restore it.

## Roadmap

- Publish to GitHub Pages
- Optional shared backend so each person can log from their own device
