# The Fitness Challenge

A tiny, no-dependencies web app for running a **365-day** group fitness challenge
(~15 people) that gets harder every week. Everything runs in the browser and is
saved to `localStorage` — no server, no build step.

## The plan

A **fixed, cumulative 52-week progression**, built to ramp up as slowly as
possible while still reaching the goal:

| Week | Push-ups | Sit-ups | Squats |
|---|---|---|---|
| 1 | 20 | — | — |
| 2 | 20 | 10 | — |
| 3 | 20 | 10 | 10 |
| … | gradual ~+1–2 / week each | | |
| 52 | **100** | **100** | **100** |

Every day you do *every* exercise that's in play, at that week's amount. The
**Full-year plan** card lists all 52 weeks so anyone can see what's coming; the
current week is highlighted. The plan lives in `app.js` (`planForWeek`) — edit
`EXERCISES` / `PLAN_TARGET` to change it.

## Features

- **Mission banner** — current day (`Day 42 of 365`), days-left countdown, a year
  progress bar, the full workout for this week, and what next week adds
- **Full-year plan** — the entire 52-week table, current week marked
- **Check-in grid** — participants down the left, calendar days across the top.
  Tap **today's** cell when you finish the week's workout. **Sundays are rest
  days** and stay blocked. Month navigation, a "days done this month" count per
  row, auto-scrolls to today.
- **Days lock at midnight** — only the current day is editable. When the date
  rolls over, yesterday locks (even in an open tab) and any missed weekday
  becomes a penalty.
- **Penalties** — a missed weekday (in-window, not Sunday, no check-in) costs a
  configurable amount (default **$20**). The Penalties card shows per-person
  missed days / owed / paid / outstanding, a team pot summary, a form to record
  payments, and a **Venmo QR + link** for collecting. New participants only owe
  from the day they were added.
- **Leaderboard** ranked by **workout days completed**, showing done-today, a
  check-in streak (🔥) that carries across Sundays, missed days, and amount owed
- **Quitting** — the "Ring the quitter's bell" card at the bottom. Pick your
  name, confirm, then type your name to drop out. It's permanent: your name
  stays on the board marked **DROPPED OUT**, penalties owed up to that day
  still stand (they stop accruing after). A re-admit (↩) button on the
  Participants list can undo it.
- **Team stats** — workout days, participants (with dropped count), best streak,
  checked in today, penalty pot
- **Motivation hero** image + watermark (see below)
- **Export / Import JSON** to move the whole challenge between devices

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Setting up the challenge

Click **Settings** and set:

- **Challenge start date** — this is Day 1. Founding members (added before Day 1)
  follow this date automatically when you change it.
- **Penalty per missed day ($)** — default 20

The weekly workout itself is fixed (see The plan, above).

## Motivation image

One file — `assets/warrior.jpg` — is used in two places:

1. the **header hero** image, and
2. a **faint watermark** fixed over the whole app.

Drop your image in at that path (JPG, or update the `src` in `index.html` and the
`url()` in `styles.css` for another name). If the file is missing the app just
hides the hero frame and the watermark — everything else works normally.
Tune the watermark strength via `opacity` in the `body::after` rule in
`styles.css` (currently `0.05`).

## Collecting penalties

The Penalties card shows `assets/venmo-qr.jpeg` (Venmo QR for `@Ozzy-Lane`) and a
link to `venmo.com/u/Ozzy-Lane`. To point it elsewhere, swap that image and edit
the two `href`s in the `.payup-block` in `index.html`. The app makes **no**
external requests — everything is local.

## Data

State is stored under the `pushup-challenge:v1` key in `localStorage`, scoped to
the browser and origin you use. Use **Export JSON** to back it up or carry it to
another device, and **Import JSON** to restore it.

## Roadmap

- Publish to GitHub Pages
- Optional shared backend so each person can log from their own device
