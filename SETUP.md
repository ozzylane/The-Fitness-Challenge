# Hosting The Fitness Challenge (GitHub Pages + Supabase)

The app is plain HTML/CSS/JS. GitHub Pages serves it for free; a free Supabase
database holds the shared check-ins so **everyone who opens the link sees
everyone's data, live**. No login — people pick their name from the list.

You (the repo owner) are the only one who can change the code. Participants can
only read and add check-ins/payments, per the database rules in `schema.sql`.

Do the steps once, in order. ~15 minutes.

---

## 1. Put the code on GitHub

```bash
cd "The Push-Up Challenge"
git remote add origin https://github.com/<you>/fitness-challenge.git
git branch -M main
git push -u origin main
```

(Repo can be public or private — Pages works with both on personal accounts.)

## 2. Turn on GitHub Pages

Repo → **Settings → Pages**:

- **Source:** Deploy from a branch
- **Branch:** `main`, folder `/ (root)` → **Save**

After a minute your site is at
`https://<you>.github.io/fitness-challenge/`. Open it — it works right now in
**local-only** mode (the status line under the banner says so).

## 3. Create the Supabase project

1. Sign up at <https://supabase.com> (free tier is plenty for 17 people).
2. **New project** → name it, pick a region near you, set a database password
   (you won't need it again), **Create**. Wait ~2 min for it to provision.

## 4. Create the tables

Supabase dashboard → **SQL Editor → New query** → paste the entire contents of
[`schema.sql`](schema.sql) → **Run**.

It creates 4 tables, the access rules, live-update wiring, and seeds the config
plus the 17-person roster. If a `add table ... supabase_realtime` line warns
"already a member", ignore it.

## 5. Point the app at your project

Supabase dashboard → **Project Settings → API** (or **Data API**). Copy:

- **Project URL** — `https://xxxxxxxx.supabase.co`
- **Project API keys → `anon` `public`** — a long string starting `eyJ...`

Edit **`supabase-config.js`** in the repo and paste them in:

```js
window.SUPABASE_URL = "https://xxxxxxxx.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOi...your-anon-key...";
```

The `anon` key is **meant** to ship in the page — it can only do what the
`schema.sql` rules allow. (Never put the `service_role` key here.)

Commit and push:

```bash
git add supabase-config.js
git commit -m "Connect to Supabase"
git push
```

Give Pages a minute, then reload the site. The status line should turn green:
**"Shared board — everyone's check-ins, live"**. Open it in two browsers and
tick a day in one — it appears in the other within a second.

## 6. Share the link

Send `https://<you>.github.io/fitness-challenge/` to the group. Everyone picks
their name and taps their day. Sundays are green rest days; miss a weekday and
`$20` is added to your tab on the Penalties card (pay via the Venmo QR there).

---

## Notes

- **Changing the roster / start date / penalty:** do it in the app (Settings, or
  the Participants card) — it writes straight to Supabase for everyone. Or edit
  the rows in the Supabase Table Editor.
- **Resetting:** disabled in the app when shared (so nobody nukes it by
  accident). To wipe, truncate the tables in the Supabase SQL editor and re-run
  the seed section of `schema.sql`.
- **Locking down `config`** (so only you can move the start date): in Supabase
  SQL editor run
  `drop policy "anon full config" on public.config;`
  and change that one row from the Table Editor when needed.
- **Backups:** the **Export JSON** button still works and dumps the current
  shared state to a file.
- **Costs:** Supabase free tier + GitHub Pages = $0 for a group this size.
- **Offline / misconfigured:** the app falls back to this browser's local
  storage and shows an amber/red status line; check-ins made then aren't shared.
