# The Fitness Challenge

A tiny, no-dependencies web app for running a **365-day** group fitness challenge
(~15 people) that gets harder every week. Everything runs in the browser and is
saved to `localStorage` — no server, no build step.

## Features

- **Mission banner** — current day (`Day 42 of 365`), days-left countdown, a year
  progress bar, this week's mission (push-ups per person, per day), and **whose
  turn it is to design next week's challenge** (the roster rotates in
  alphabetical order)
- **Weekly progression** — Week 1 target + a fixed weekly increase. Configurable
  in **Settings**; the person on rotation can bump it each week.
- **Check-in grid** — participants down the left, calendar days across the top.
  Tap **today's** cell when you finish your push-ups. **Sundays are rest days**
  and stay blocked out. Month navigation, a "days completed this month" count per
  row, and it auto-scrolls to today. Hitting the day's rep target auto-checks
  today.
- **Days lock at midnight** — only the current day is editable. When the date
  rolls over, yesterday locks (even in an open tab) and any missed weekday
  becomes a penalty. Logging reps is also today-only.
- **Penalties** — a missed weekday (in-window, not Sunday, no check-in) costs a
  configurable amount (default **$20**). The Penalties card shows per-person
  missed days / owed / paid / outstanding, a team pot summary, a form to record
  payments, and a **Venmo QR + link** for actually collecting the money. New
  participants only owe from the day they were added.
- **Leaderboard** ranked by total reps, showing `done today`, `reps / target`,
  a check-in streak (🔥) that carries across Sundays, and any amount owed
- **Quitting** — the "Ring the quitter's bell" card at the bottom. Pick your
  name, confirm, then type your name to drop out. It's permanent: your name
  stays on the board marked **DROPPED OUT**, penalties owed up to that day
  still stand (they stop accruing after), and you leave the weekly rotation.
  A re-admit (↩) button on the Participants list can undo it.
- **Team stats** — total reps, participants (with dropped count), reps today,
  checked in today, penalty pot
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

- **Challenge start date** — this is Day 1. Founding members (added before Day 1)
  follow this date automatically when you change it.
- **Week 1 target** — push-ups per person, per day, in the first week
- **Weekly increase** — reps/day added at the start of each new week
- **Penalty per missed day ($)** — default 20

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
