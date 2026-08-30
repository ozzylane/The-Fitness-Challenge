/* The Push-Up Challenge — local, 365-day progressive group tracker.
 * State lives in localStorage under STORAGE_KEY. No network calls. */

const STORAGE_KEY = "pushup-challenge:v1";
const CHART_DAYS = 30;
const TOTAL_DAYS = 365;

const DEFAULT_STATE = () => ({
  people: [],   // [{ id, name, since: "YYYY-MM-DD" }]
  entries: [],  // [{ id, personId, date: "YYYY-MM-DD", reps }]
  // Day-completed check-ins: { [personId]: { "YYYY-MM-DD": true } }
  checkins: {},
  // Penalty payments recorded against what people owe: [{ id, personId, amount, date, note }]
  payments: [],
  // Weekly plan: week 1 asks weekBase reps/person/day; every later week adds weekStep.
  // penalty: $ owed for each missed (non-Sunday, in-window) day with no check-in.
  config: { start: todayStr(), weekBase: 20, weekStep: 5, penalty: 20 },
});

// Roster, alphabetical. Seeded on first run (or into an untouched save).
const SEED_PEOPLE = [
  "Adeeb", "Alen", "Antonio", "Blake", "Carlos", "Drew", "Eileen", "Jeff",
  "Jim", "Johnny", "Jorge", "Kati", "Mo", "Ozzy", "Rafael", "Simon", "Vince",
];

function seedRoster(startDate) {
  return SEED_PEOPLE.map((name) => ({ id: uid(), name, since: startDate }));
}

function seededState() {
  const s = DEFAULT_STATE();
  s.people = seedRoster(s.config.start);
  return s;
}

let state = load();
save();

/* ---------- persistence ---------- */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seededState();
    const parsed = JSON.parse(raw);
    const base = DEFAULT_STATE();
    const merged = { ...base, ...parsed };
    merged.config = { ...base.config, ...(parsed.config || {}) };
    merged.checkins = parsed.checkins && typeof parsed.checkins === "object" ? parsed.checkins : {};
    merged.payments = Array.isArray(parsed.payments) ? parsed.payments : [];
    // Migrate the old { goal: { start } } shape.
    if (!parsed.config && parsed.goal && parsed.goal.start) {
      merged.config.start = parsed.goal.start;
    }
    delete merged.goal;
    // Seed the roster if this save has never had anything entered in it.
    if (
      merged.people.length === 0 &&
      merged.entries.length === 0 &&
      Object.keys(merged.checkins).length === 0
    ) {
      merged.people = seedRoster(merged.config.start);
    }
    // Back-fill "since" for older saves: treat them as founding members.
    for (const p of merged.people) {
      if (!p.since) p.since = merged.config.start;
    }
    return merged;
  } catch (err) {
    console.warn("Could not read saved data, starting fresh.", err);
    return seededState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    alert("Could not save data: " + err.message);
  }
}

/* ---------- date / challenge math ---------- */

function todayStr(d = new Date()) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 1 on the start date, 0 or negative before it, > TOTAL_DAYS once finished. */
function challengeDay(dateStr = todayStr()) {
  const start = new Date(state.config.start + "T00:00:00");
  const now = new Date(dateStr + "T00:00:00");
  return Math.floor((now - start) / 86400000) + 1;
}

function challengeWeek(day = challengeDay()) {
  return Math.max(1, Math.ceil(day / 7));
}

/** Push-ups per person per day for a given challenge week. */
function dailyTarget(week = challengeWeek()) {
  return state.config.weekBase + (Math.max(1, week) - 1) * state.config.weekStep;
}

/** Per-person target that applied on a specific calendar date. */
function dailyTargetForDate(dateStr) {
  return dailyTarget(challengeWeek(challengeDay(dateStr)));
}

function isQuit(personId) {
  const p = state.people.find((x) => x.id === personId);
  return !!(p && p.quitDate);
}

/** Participants still in the challenge (not dropped out). */
function activePeople() {
  return state.people.filter((p) => !p.quitDate);
}

/** Whose turn it is to design a given week's challenge — the active roster
 *  rotates in alphabetical order, wrapping around. */
function weekCreator(weekNum) {
  const sorted = activePeople().slice().sort((a, b) => a.name.localeCompare(b.name));
  if (sorted.length === 0) return null;
  const i = ((weekNum - 1) % sorted.length + sorted.length) % sorted.length;
  return sorted[i].name;
}

/** Sunday is a rest day — no activity, cells blocked out. */
function isSunday(dateStr) {
  return new Date(dateStr + "T00:00:00").getDay() === 0;
}

function ymd(year, monthIdx, day) {
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function isActive(day = challengeDay()) {
  return day >= 1 && day <= TOTAL_DAYS;
}

/** Per-person target for right now, or null if the challenge isn't running. */
function targetNow() {
  return isActive() ? dailyTarget() : null;
}

/* ---------- aggregate helpers ---------- */

function repsFor(predicate) {
  return state.entries.filter(predicate).reduce((sum, e) => sum + e.reps, 0);
}

function totalForPerson(id) {
  return repsFor((e) => e.personId === id);
}

function todayForPerson(id) {
  return repsFor((e) => e.personId === id && e.date === todayStr());
}

function streakForPerson(id) {
  const days = new Set(
    state.entries.filter((e) => e.personId === id && e.reps > 0).map((e) => e.date)
  );
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  if (!days.has(todayStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(todayStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function personName(id) {
  const p = state.people.find((x) => x.id === id);
  return p ? p.name : "(removed)";
}

/* ---------- check-ins ---------- */

function isChecked(personId, dateStr) {
  return !!(state.checkins[personId] && state.checkins[personId][dateStr]);
}

function setCheckin(personId, dateStr, val) {
  if (val) {
    if (!state.checkins[personId]) state.checkins[personId] = {};
    state.checkins[personId][dateStr] = true;
  } else if (state.checkins[personId]) {
    delete state.checkins[personId][dateStr];
    if (Object.keys(state.checkins[personId]).length === 0) delete state.checkins[personId];
  }
}

function toggleCheckin(personId, dateStr) {
  setCheckin(personId, dateStr, !isChecked(personId, dateStr));
  save();
  render();
}

function checkinCount(personId, fromStr, toStr) {
  const days = state.checkins[personId] || {};
  return Object.keys(days).filter((d) => d >= fromStr && d <= toStr).length;
}

/** Consecutive completed days ending today; Sundays are skipped, not counted. */
function checkinStreak(personId) {
  const cur = new Date(todayStr() + "T00:00:00");
  const back = () => cur.setDate(cur.getDate() - 1);
  if (cur.getDay() === 0) back();
  if (!isChecked(personId, todayStr(cur))) {
    back();
    if (cur.getDay() === 0) back();
  }
  let streak = 0;
  while (challengeDay(todayStr(cur)) >= 1) {
    if (cur.getDay() === 0) { back(); continue; }
    if (!isChecked(personId, todayStr(cur))) break;
    streak += 1;
    back();
  }
  return streak;
}

/* ---------- penalties ---------- */

function penaltyPerDay() {
  const p = Number(state.config.penalty);
  return Number.isFinite(p) && p >= 0 ? p : 20;
}

/** The date penalties start counting for a person: their join date, or the
 *  challenge start if that's later — whichever means they were "in". */
function penaltyStartFor(personId) {
  const person = state.people.find((p) => p.id === personId);
  const since = person && person.since ? person.since : state.config.start;
  return since > state.config.start ? since : state.config.start;
}

/** Past days (not today, not future) that were missed: in the challenge window,
 *  not a Sunday, and with no check-in. Stops accruing on the day someone quits. */
function missedDaysFor(personId) {
  const today = todayStr();
  const person = state.people.find((p) => p.id === personId);
  const stop = person && person.quitDate && person.quitDate < today ? person.quitDate : today;
  const cur = new Date(penaltyStartFor(personId) + "T00:00:00");
  const end = new Date(stop + "T00:00:00"); // the stop day itself is not counted
  let missed = 0;
  while (cur < end) {
    const ds = todayStr(cur);
    const cd = challengeDay(ds);
    if (cd >= 1 && cd <= TOTAL_DAYS && !isSunday(ds) && !isChecked(personId, ds)) {
      missed += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return missed;
}

function owedBy(personId) {
  return missedDaysFor(personId) * penaltyPerDay();
}

function paidBy(personId) {
  return state.payments
    .filter((p) => p.personId === personId)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

function outstandingBy(personId) {
  return owedBy(personId) - paidBy(personId);
}

function money(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "-$" : "$") + fmt(Math.abs(v));
}

/* ---------- rendering ---------- */

function render() {
  renderPeopleSelects();
  renderBanner();
  renderTeamStats();
  renderTodayProgress();
  renderGrid();
  renderPenalties();
  renderLeaderboard();
  renderChart();
  renderPeopleList();
  renderHistory();
}

function renderBanner() {
  const el = document.getElementById("banner");
  const day = challengeDay();

  if (day < 1) {
    const starts = 1 - day;
    const firstCreator = weekCreator(1);
    el.className = "banner pre";
    el.innerHTML = `
      <div class="banner-top">Challenge starts in ${starts} day${starts === 1 ? "" : "s"}</div>
      <div class="banner-mission">Week 1 mission &middot; <strong>${fmt(dailyTarget(1))}</strong> push-ups per day</div>
      <div class="year-bar"><span style="width:0%"></span></div>
      <div class="banner-sub">Day 1 is ${state.config.start}${
        firstCreator ? ` &middot; ${escapeHtml(firstCreator)} designs week 1` : ""
      }</div>`;
    return;
  }

  if (day > TOTAL_DAYS) {
    el.className = "banner done";
    el.innerHTML = `
      <div class="banner-top">&#127937; Challenge complete &middot; ${TOTAL_DAYS} / ${TOTAL_DAYS} days</div>
      <div class="banner-mission"><strong>${fmt(repsFor(() => true))}</strong> total push-ups logged by the team</div>
      <div class="year-bar"><span style="width:100%"></span></div>`;
    return;
  }

  const week = challengeWeek(day);
  const target = dailyTarget(week);
  const left = TOTAL_DAYS - day;
  const pct = (day / TOTAL_DAYS) * 100;
  const dayOfWeek = ((day - 1) % 7) + 1;
  const thisCreator = weekCreator(week);
  const nextCreator = weekCreator(week + 1);

  const nextLine = nextCreator
    ? `<strong>${escapeHtml(nextCreator)}</strong> designs next week's challenge`
    : "add participants to set the rotation";
  const thisLine = thisCreator ? ` &middot; this week by ${escapeHtml(thisCreator)}` : "";

  el.className = "banner";
  el.innerHTML = `
    <div class="banner-top">
      <span class="day-num">Day ${day}</span><span class="day-of"> of ${TOTAL_DAYS}</span>
      <span class="banner-count">${left} day${left === 1 ? "" : "s"} left</span>
    </div>
    <div class="banner-mission">Week ${week} mission &middot; <strong>${fmt(target)}</strong> push-ups per person, per day</div>
    <div class="year-bar"><span style="width:${pct.toFixed(2)}%"></span></div>
    <div class="banner-sub">Day ${dayOfWeek} of 7 this week &middot; ${nextLine}${thisLine}</div>`;
}

function renderPeopleSelects() {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const opt = (p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
  const allOpts = state.people.slice().sort(byName).map(opt).join("");
  const activeOpts = activePeople().slice().sort(byName).map(opt).join("");

  // Logging a set and quitting are for active participants only.
  for (const id of ["who-input", "quit-who"]) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const prev = sel.value;
    sel.innerHTML =
      activeOpts || `<option value="" disabled selected>No active participants</option>`;
    if (prev && activePeople().some((p) => p.id === prev)) sel.value = prev;
  }

  // Chart / history filters keep everyone, including people who dropped out.
  for (const id of ["chart-who", "history-who"]) {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = `<option value="__all__">Everyone</option>` + allOpts;
    if (prev && (prev === "__all__" || state.people.some((p) => p.id === prev))) sel.value = prev;
  }
}

function renderTeamStats() {
  const active = activePeople();
  const dropped = state.people.length - active.length;

  document.getElementById("stat-team-total").textContent = fmt(repsFor(() => true));
  document.getElementById("stat-participants").innerHTML =
    active.length + (dropped ? ` <span class="stat-sub">(${dropped} out)</span>` : "");
  document.getElementById("stat-today-total").textContent = fmt(repsFor((e) => e.date === todayStr()));

  const checkedInEl = document.getElementById("stat-checkedin");
  if (active.length === 0) {
    checkedInEl.textContent = "—";
  } else {
    const checked = active.filter((p) => isChecked(p.id, todayStr())).length;
    checkedInEl.textContent = `${checked}/${active.length}`;
  }

  const outstanding = state.people.reduce((s, p) => s + Math.max(0, outstandingBy(p.id)), 0);
  document.getElementById("stat-pot").textContent = money(outstanding);
}

function renderTodayProgress() {
  const day = challengeDay();
  const people = Math.max(1, activePeople().length);
  const per = dailyTarget();
  const goalToday = per * people;
  const doneToday = repsFor((e) => e.date === todayStr());
  const detail = document.getElementById("goal-detail");
  const fill = document.getElementById("progress-fill");

  if (!isActive(day)) {
    detail.textContent = day < 1 ? "Challenge hasn't started yet" : "Challenge complete";
    fill.style.width = day < 1 ? "0%" : "100%";
    return;
  }
  const pct = goalToday > 0 ? Math.min(100, (doneToday / goalToday) * 100) : 0;
  detail.textContent = `${fmt(doneToday)} / ${fmt(goalToday)} reps today (${fmt(per)}/person × ${people})`;
  fill.style.width = pct.toFixed(1) + "%";
}

/* Month being shown in the check-in grid (not persisted). */
let gridYear, gridMonth;
(function initGridMonth() {
  const t = todayStr();
  gridYear = Number(t.slice(0, 4));
  gridMonth = Number(t.slice(5, 7)) - 1;
})();

function renderGrid() {
  const table = document.getElementById("checkgrid");
  const label = document.getElementById("month-label");
  label.textContent = new Date(gridYear, gridMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  if (state.people.length === 0) {
    table.innerHTML = `<tbody><tr><td class="empty">Add participants to build the grid.</td></tr></tbody>`;
    return;
  }

  const today = todayStr();
  const dowLetter = ["Su", "M", "T", "W", "T", "F", "S"];
  const n = daysInMonth(gridYear, gridMonth);
  const days = [];
  for (let d = 1; d <= n; d++) {
    const ds = ymd(gridYear, gridMonth, d);
    const dow = new Date(gridYear, gridMonth, d).getDay();
    const cd = challengeDay(ds);
    days.push({
      d,
      ds,
      dow,
      sunday: dow === 0,
      future: ds > today,
      inWindow: cd >= 1 && cd <= TOTAL_DAYS,
      isToday: ds === today,
    });
  }

  let head = `<thead><tr><th class="corner">Participant</th>`;
  for (const day of days) {
    const cls = [day.sunday ? "blocked" : "", day.isToday ? "today-col" : ""].join(" ").trim();
    head += `<th class="${cls}"><span class="dnum">${day.d}</span><span class="dow">${
      dowLetter[day.dow]
    }</span></th>`;
  }
  head += `<th class="mtd" title="Days completed this month">✓</th></tr></thead>`;

  const people = state.people.slice().sort((a, b) => a.name.localeCompare(b.name));
  let body = "<tbody>";
  for (const p of people) {
    let mtd = 0;
    const out = !!p.quitDate;
    body += `<tr class="${out ? "quit" : ""}"><th class="name" scope="row" title="${escapeHtml(
      p.name
    )}">${escapeHtml(p.name)}${out ? ` <span class="tag-out">OUT</span>` : ""}</th>`;
    const pStart = penaltyStartFor(p.id);
    for (const day of days) {
      if (day.sunday) {
        body += `<td class="blocked" aria-hidden="true"></td>`;
        continue;
      }
      const done = isChecked(p.id, day.ds);
      if (done) mtd++;
      const clickable = day.inWindow && day.isToday && !out; // only today, only if still in
      const past = day.inWindow && !day.future && !day.isToday;
      const missed =
        past && !done && day.ds >= pStart && (!p.quitDate || day.ds < p.quitDate);
      const cls = [
        "cell",
        done ? "done" : "",
        day.isToday ? "today-col" : "",
        missed ? "missed" : "",
        clickable ? "" : "locked",
      ]
        .join(" ")
        .trim();
      const title = missed
        ? `${day.ds} · missed (${money(penaltyPerDay())})`
        : done
        ? `${day.ds} · done`
        : day.ds;
      const attrs = clickable
        ? ` role="button" tabindex="0" data-person="${p.id}" data-date="${day.ds}" title="${escapeHtml(
            p.name
          )} · ${day.ds}"`
        : ` title="${title}"`;
      body += `<td class="${cls}"${attrs}>${done ? "✓" : missed ? "✕" : ""}</td>`;
    }
    body += `<td class="mtd">${mtd}</td></tr>`;
  }
  body += "</tbody>";
  table.innerHTML = head + body;

  // Bring today into view when the month first opens (not on every check-in).
  const key = gridYear + "-" + gridMonth;
  if (key !== renderGrid._lastKey) {
    renderGrid._lastKey = key;
    const scroller = document.querySelector(".grid-scroll");
    const todayCell = table.querySelector("tbody .today-col");
    if (scroller && todayCell) {
      scroller.scrollLeft = Math.max(0, todayCell.offsetLeft - scroller.clientWidth / 2);
    }
  }
}

function shiftGridMonth(delta) {
  gridMonth += delta;
  while (gridMonth < 0) {
    gridMonth += 12;
    gridYear -= 1;
  }
  while (gridMonth > 11) {
    gridMonth -= 12;
    gridYear += 1;
  }
  renderGrid();
}

function renderPenalties() {
  const summary = document.getElementById("penalty-summary");
  const tbody = document.getElementById("penalty-rows");
  const payEl = document.getElementById("payments-list");
  const paySelect = document.getElementById("pay-who");

  const rows = state.people
    .map((p) => {
      const owed = owedBy(p.id);
      const paid = paidBy(p.id);
      return {
        id: p.id,
        name: p.name,
        quit: !!p.quitDate,
        missed: missedDaysFor(p.id),
        owed,
        paid,
        outstanding: owed - paid,
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));

  const totOwed = rows.reduce((s, r) => s + r.owed, 0);
  const totPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totOut = rows.reduce((s, r) => s + Math.max(0, r.outstanding), 0);

  summary.innerHTML =
    `The pot: <strong>${money(totOwed)}</strong> owed &middot; ` +
    `<strong>${money(totPaid)}</strong> collected &middot; ` +
    `<strong class="out">${money(totOut)}</strong> outstanding ` +
    `<span class="muted">(${money(penaltyPerDay())} per missed day)</span>`;

  if (state.people.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No participants yet.</td></tr>`;
  } else {
    tbody.innerHTML = rows
      .map(
        (r) => `
        <tr class="${r.quit ? "quit " : ""}${
          r.outstanding > 0 ? "owes" : r.owed > 0 ? "settled" : ""
        }">
          <td class="pt-name">${escapeHtml(r.name)}${
          r.quit ? ` <span class="tag-out">OUT</span>` : ""
        }</td>
          <td>${r.missed}</td>
          <td>${money(r.owed)}</td>
          <td>${money(r.paid)}</td>
          <td class="pt-out">${money(r.outstanding)}</td>
        </tr>`
      )
      .join("");
  }

  // payment recorder — participant dropdown
  const prev = paySelect.value;
  paySelect.innerHTML = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");
  if (prev && state.people.some((p) => p.id === prev)) paySelect.value = prev;

  // recent payments
  const pays = state.payments
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 30);
  payEl.innerHTML = pays.length
    ? pays
        .map(
          (p) => `
        <li>
          <span class="h-date">${p.date} · ${escapeHtml(personName(p.personId))}${
            p.note ? " · " + escapeHtml(p.note) : ""
          }</span>
          <span class="h-reps">${money(p.amount)}</span>
          <button class="h-del" data-payment="${p.id}" title="Delete this payment">✕</button>
        </li>`
        )
        .join("")
    : `<li class="empty">No payments recorded yet.</li>`;
}

function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (state.people.length === 0) {
    el.innerHTML = `<li class="empty">No participants yet.</li>`;
    return;
  }
  const target = targetNow();
  const rows = state.people
    .map((p) => ({
      id: p.id,
      name: p.name,
      quit: !!p.quitDate,
      total: totalForPerson(p.id),
      today: todayForPerson(p.id),
      checkedToday: isChecked(p.id, todayStr()),
      streak: checkinStreak(p.id),
      outstanding: outstandingBy(p.id),
    }))
    // active first, then by reps
    .sort(
      (a, b) =>
        Number(a.quit) - Number(b.quit) ||
        b.total - a.total ||
        a.name.localeCompare(b.name)
    );

  const max = Math.max(1, rows[0].total);
  const medals = ["🥇", "🥈", "🥉"];
  let activeRank = 0;

  el.innerHTML = rows
    .map((r) => {
      const barPct = (r.total / max) * 100;
      const rank = r.quit ? "&nbsp;" : (activeRank++, medals[activeRank - 1] || `${activeRank}.`);
      const parts = [];
      if (r.quit) parts.push("dropped out");
      if (r.checkedToday) parts.push("✓ done today");
      if (target != null && !r.quit) parts.push(`${fmt(r.today)}/${fmt(target)} reps`);
      else if (r.today) parts.push(`+${fmt(r.today)} reps`);
      if (r.streak > 1) parts.push(`${r.streak}🔥`);
      if (r.outstanding > 0) parts.push(`owes ${money(r.outstanding)}`);
      return `
      <li class="lb-row${r.checkedToday ? " hit" : ""}${r.quit ? " quit" : ""}">
        <span class="lb-rank">${rank}</span>
        <span class="lb-name">${escapeHtml(r.name)}</span>
        <span class="lb-bar"><span style="width:${barPct}%"></span></span>
        <span class="lb-total">${fmt(r.total)}</span>
        <span class="lb-meta muted">${parts.join(" · ")}</span>
      </li>`;
    })
    .join("");
}

function renderChart() {
  const who = document.getElementById("chart-who").value || "__all__";
  document.getElementById("chart-title").textContent =
    "Last 30 days" + (who === "__all__" ? " — everyone" : " — " + personName(who));

  const days = [];
  const base = new Date(todayStr() + "T00:00:00");
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const ds = todayStr(d);
    const reps = repsFor((e) => e.date === ds && (who === "__all__" || e.personId === who));
    days.push({ ds, reps });
  }

  const per = targetNow();
  const target =
    per == null ? null : who === "__all__" ? per * Math.max(1, activePeople().length) : per;
  const max = Math.max(1, target || 0, ...days.map((d) => d.reps));

  const chart = document.getElementById("chart");
  const bars = days
    .map((d) => {
      const h = (d.reps / max) * 100;
      const cls =
        "bar" + (d.reps > 0 ? " has-value" : "") + (d.ds === todayStr() ? " today" : "");
      return `<div class="${cls}" style="height:${Math.max(2, h)}%" title="${d.ds}: ${fmt(
        d.reps
      )}"></div>`;
    })
    .join("");
  let line = "";
  if (target != null) {
    const bottomPct = (target / max) * 100;
    const labelBelow = bottomPct > 88 ? " label-below" : "";
    line = `<div class="chart-target${labelBelow}" style="bottom:${bottomPct.toFixed(
      1
    )}%"><span>target ${fmt(target)}/day</span></div>`;
  }
  chart.innerHTML = bars + line;
}

function renderPeopleList() {
  const el = document.getElementById("people-list");
  if (state.people.length === 0) {
    el.innerHTML = `<li class="empty">No participants yet. Add up to ~15 people above.</li>`;
    return;
  }
  el.innerHTML = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const out = !!p.quitDate;
      const label = out
        ? `${escapeHtml(p.name)} <span class="dropped">DROPPED OUT · ${p.quitDate}</span>`
        : escapeHtml(p.name);
      const rightBtn = out
        ? `<button class="h-del readmit" data-readmit="${p.id}" title="Re-admit ${escapeHtml(
            p.name
          )}">↩</button>`
        : `<button class="h-del" data-person="${p.id}" title="Remove ${escapeHtml(
            p.name
          )}">✕</button>`;
      return `
      <li class="${out ? "quit" : ""}">
        <span class="h-date">${label}</span>
        <span class="h-reps">${fmt(totalForPerson(p.id))}</span>
        ${rightBtn}
      </li>`;
    })
    .join("");
}

function renderHistory() {
  const who = document.getElementById("history-who").value || "__all__";
  const el = document.getElementById("history");
  const list = state.entries
    .filter((e) => who === "__all__" || e.personId === who)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 40);

  if (list.length === 0) {
    el.innerHTML = `<li class="empty">No sets logged yet.</li>`;
    return;
  }
  el.innerHTML = list
    .map(
      (e) => `
      <li>
        <span class="h-date">${e.date} · ${escapeHtml(personName(e.personId))}</span>
        <span class="h-reps">${fmt(e.reps)}</span>
        <button class="h-del" data-entry="${e.id}" title="Delete this set">✕</button>
      </li>`
    )
    .join("");
}

/* ---------- utils ---------- */

function fmt(n) {
  return Number(n).toLocaleString();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

/* ---------- actions ---------- */

function addPerson(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (state.people.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    alert(`"${trimmed}" is already on the list.`);
    return;
  }
  state.people.push({ id: uid(), name: trimmed, since: todayStr() });
  save();
  render();
}

function removePerson(id) {
  const p = state.people.find((x) => x.id === id);
  if (!p) return;
  const count = state.entries.filter((e) => e.personId === id).length;
  const msg = count
    ? `Remove ${p.name} and their ${count} logged set(s)? This can't be undone.`
    : `Remove ${p.name}?`;
  if (!confirm(msg)) return;
  state.people = state.people.filter((x) => x.id !== id);
  state.entries = state.entries.filter((e) => e.personId !== id);
  state.payments = state.payments.filter((pm) => pm.personId !== id);
  delete state.checkins[id];
  save();
  render();
}

function quitPerson(personId) {
  const p = state.people.find((x) => x.id === personId);
  if (!p || p.quitDate) return;
  p.quitDate = todayStr();
  save();
  render();
}

function readmitPerson(personId) {
  const p = state.people.find((x) => x.id === personId);
  if (!p || !p.quitDate) return;
  if (!confirm(`Bring ${p.name} back into the challenge?`)) return;
  delete p.quitDate;
  save();
  render();
}

function addEntry(personId, reps, date) {
  reps = Math.floor(Number(reps));
  if (!personId || !state.people.some((p) => p.id === personId)) {
    alert("Pick a participant first.");
    return;
  }
  if (!Number.isFinite(reps) || reps < 1) {
    alert("Enter a rep count of 1 or more.");
    return;
  }
  const d = date || todayStr();
  if (d !== todayStr()) {
    alert("You can only log for today — past days lock at midnight.");
    return;
  }
  state.entries.push({ id: uid(), personId, date: d, reps });
  // Hitting the day's target auto-completes today's check-in.
  const cd = challengeDay(d);
  if (cd >= 1 && cd <= TOTAL_DAYS && !isSunday(d)) {
    const dayReps = repsFor((e) => e.personId === personId && e.date === d);
    if (dayReps >= dailyTargetForDate(d)) setCheckin(personId, d, true);
  }
  save();
  render();
}

function removeEntry(id) {
  state.entries = state.entries.filter((e) => e.id !== id);
  save();
  render();
}

function addPayment(personId, amount, note) {
  amount = Math.round(Number(amount));
  if (!personId || !state.people.some((p) => p.id === personId)) {
    alert("Pick a participant.");
    return;
  }
  if (!Number.isFinite(amount) || amount === 0) {
    alert("Enter a payment amount (use a negative number to correct a mistake).");
    return;
  }
  state.payments.push({
    id: uid(),
    personId,
    amount,
    date: todayStr(),
    note: (note || "").trim(),
  });
  save();
  render();
}

function removePayment(id) {
  state.payments = state.payments.filter((p) => p.id !== id);
  save();
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pushup-challenge-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.people) || !Array.isArray(data.entries)) {
        throw new Error("File doesn't look like a Push-Up Challenge export.");
      }
      if (!confirm("Replace all current data with the imported file?")) return;
      const base = DEFAULT_STATE();
      state = { ...base, ...data, config: { ...base.config, ...(data.config || {}) } };
      if (!state.checkins || typeof state.checkins !== "object") state.checkins = {};
      if (!Array.isArray(state.payments)) state.payments = [];
      for (const p of state.people) if (!p.since) p.since = state.config.start;
      delete state.goal;
      save();
      render();
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(file);
}

/* ---------- wire up ---------- */

const dateInput = document.getElementById("date-input");
function lockDateInputToToday() {
  const t = todayStr();
  dateInput.value = t;
  dateInput.min = t;
  dateInput.max = t;
}
lockDateInputToToday();

document.getElementById("log-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const who = document.getElementById("who-input").value;
  const reps = document.getElementById("reps-input").value;
  const date = document.getElementById("date-input").value || todayStr();
  addEntry(who, reps, date);
  document.getElementById("reps-input").value = "";
  document.getElementById("reps-input").focus();
});

document.getElementById("quick-add").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-reps]");
  if (!btn) return;
  const who = document.getElementById("who-input").value;
  const date = document.getElementById("date-input").value || todayStr();
  addEntry(who, btn.dataset.reps, date);
});

document.getElementById("add-person-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("person-name");
  addPerson(input.value);
  input.value = "";
  input.focus();
});

document.getElementById("people-list").addEventListener("click", (e) => {
  const rm = e.target.closest("button[data-person]");
  if (rm) removePerson(rm.dataset.person);
  const re = e.target.closest("button[data-readmit]");
  if (re) readmitPerson(re.dataset.readmit);
});

/* quit the challenge */
document.getElementById("quit-btn").addEventListener("click", () => {
  const id = document.getElementById("quit-who").value;
  const person = state.people.find((p) => p.id === id);
  if (!person) {
    alert("Pick who's quitting first.");
    return;
  }
  if (person.quitDate) {
    alert(`${person.name} already dropped out.`);
    return;
  }
  const sure = confirm(
    `Are you sure you want to QUIT The Push-Up Challenge?\n\n` +
      `This is permanent. "${person.name}" stays on the board marked DROPPED OUT, ` +
      `and any penalties owed up to today still stand.`
  );
  if (!sure) return;
  const typed = prompt(`Type "${person.name}" exactly to confirm you are dropping out:`);
  if (typed === null) return;
  if (typed.trim().toLowerCase() !== person.name.toLowerCase()) {
    alert("That didn't match your name — you're still in. Keep going.");
    return;
  }
  quitPerson(id);
  alert(`${person.name} has dropped out of The Push-Up Challenge.`);
});

document.getElementById("history").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-entry]");
  if (btn) removeEntry(btn.dataset.entry);
});

/* penalties */
document.getElementById("pay-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const who = document.getElementById("pay-who").value;
  const amt = document.getElementById("pay-amount").value;
  const note = document.getElementById("pay-note").value;
  addPayment(who, amt, note);
  document.getElementById("pay-amount").value = "";
  document.getElementById("pay-note").value = "";
});
document.getElementById("payments-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-payment]");
  if (btn) removePayment(btn.dataset.payment);
});

document.getElementById("chart-who").addEventListener("change", renderChart);
document.getElementById("history-who").addEventListener("change", renderHistory);

/* check-in grid */
function handleGridActivate(e) {
  const cell = e.target.closest("td.cell[data-person]");
  if (!cell) return;
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  toggleCheckin(cell.dataset.person, cell.dataset.date);
}
document.getElementById("checkgrid").addEventListener("click", handleGridActivate);
document.getElementById("checkgrid").addEventListener("keydown", handleGridActivate);
document.getElementById("month-prev").addEventListener("click", () => shiftGridMonth(-1));
document.getElementById("month-next").addEventListener("click", () => shiftGridMonth(1));
document.getElementById("month-today").addEventListener("click", () => {
  const t = todayStr();
  gridYear = Number(t.slice(0, 4));
  gridMonth = Number(t.slice(5, 7)) - 1;
  renderGrid._lastKey = null; // force re-scroll to today
  renderGrid();
});

/* settings dialog */
const goalDialog = document.getElementById("goal-dialog");
const cfgStart = document.getElementById("cfg-start");
const cfgBase = document.getElementById("cfg-base");
const cfgStep = document.getElementById("cfg-step");
const cfgPenalty = document.getElementById("cfg-penalty");
const cfgPreview = document.getElementById("cfg-preview");

function updateCfgPreview() {
  const b = Math.max(1, Math.floor(Number(cfgBase.value)) || 0);
  const s = Math.max(0, Math.floor(Number(cfgStep.value)) || 0);
  const wk = (n) => fmt(b + (n - 1) * s);
  cfgPreview.textContent = `Week 1: ${wk(1)}/day · Week 13: ${wk(13)}/day · Week 26: ${wk(26)}/day · Week 52: ${wk(52)}/day`;
}

document.getElementById("edit-goal").addEventListener("click", () => {
  cfgStart.value = state.config.start;
  cfgBase.value = state.config.weekBase;
  cfgStep.value = state.config.weekStep;
  cfgPenalty.value = penaltyPerDay();
  updateCfgPreview();
  goalDialog.showModal();
});
cfgBase.addEventListener("input", updateCfgPreview);
cfgStep.addEventListener("input", updateCfgPreview);

goalDialog.querySelector("form").addEventListener("submit", (e) => {
  // The form uses method="dialog"; it still closes itself after this handler.
  const action = e.submitter ? e.submitter.value : goalDialog.returnValue;
  if (action !== "save") return;
  const oldStart = state.config.start;
  const newStart = cfgStart.value || todayStr();
  state.config = {
    start: newStart,
    weekBase: Math.max(1, Math.floor(Number(cfgBase.value)) || 1),
    weekStep: Math.max(0, Math.floor(Number(cfgStep.value)) || 0),
    penalty: Math.max(0, Math.floor(Number(cfgPenalty.value)) || 0),
  };
  // Founding members (joined on the old Day 1) follow the start date when it moves.
  if (newStart !== oldStart) {
    for (const p of state.people) {
      if (!p.since || p.since === oldStart) p.since = newStart;
    }
  }
  save();
  render();
});

/* data buttons */
document.getElementById("export-btn").addEventListener("click", exportJson);
document.getElementById("import-btn").addEventListener("click", () =>
  document.getElementById("import-file").click()
);
document.getElementById("import-file").addEventListener("change", (e) => {
  if (e.target.files[0]) importJson(e.target.files[0]);
  e.target.value = "";
});
document.getElementById("reset-btn").addEventListener("click", () => {
  if (!confirm("Erase all participants, sets, and challenge settings?")) return;
  state = DEFAULT_STATE();
  save();
  render();
});

/* motivation hero: hide the frame if the image is missing, rotate a daily line */
const heroImg = document.getElementById("hero-img");
function hideHeroMedia() {
  document.querySelector(".hero-media").style.display = "none";
  document.querySelector(".hero").classList.add("no-media");
}
heroImg.addEventListener("error", hideHeroMedia);
if (heroImg.complete && heroImg.naturalWidth === 0) hideHeroMedia();
const HERO_LINES = [
  "The spear is earned one rep at a time.",
  "Show up on the days you don't feel like it.",
  "Rest on Sunday. Hunt the other six.",
  "Every checked box is armor.",
  "The warrior isn't born on day 365 — he's built by day 12.",
  "Weak reps still count. Skipped days don't.",
  "Hold the line. The chain is watching.",
];
(function setHeroLine() {
  const day = Math.max(1, challengeDay());
  document.getElementById("hero-quote").textContent =
    "“" + HERO_LINES[day % HERO_LINES.length] + "”";
})();

/* When the date rolls over (midnight), yesterday locks and its misses become
   penalties — re-render so an open tab stays correct. */
let lastSeenDate = todayStr();
setInterval(() => {
  const t = todayStr();
  if (t !== lastSeenDate) {
    lastSeenDate = t;
    lockDateInputToToday();
    renderGrid._lastKey = null;
    render();
  }
}, 30000);

render();
