/* The Push-Up Challenge — local, 365-day progressive group tracker.
 * State lives in localStorage under STORAGE_KEY. No network calls. */

const STORAGE_KEY = "pushup-challenge:v1";
const CHART_DAYS = 30;
const TOTAL_DAYS = 365;

const DEFAULT_STATE = () => ({
  people: [],   // [{ id, name }]
  entries: [],  // [{ id, personId, date: "YYYY-MM-DD", reps }]
  // Weekly plan: week 1 asks weekBase reps/person/day; every later week adds weekStep.
  config: { start: todayStr(), weekBase: 20, weekStep: 5 },
});

let state = load();

/* ---------- persistence ---------- */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    const base = DEFAULT_STATE();
    const merged = { ...base, ...parsed };
    merged.config = { ...base.config, ...(parsed.config || {}) };
    // Migrate the old { goal: { start } } shape.
    if (!parsed.config && parsed.goal && parsed.goal.start) {
      merged.config.start = parsed.goal.start;
    }
    delete merged.goal;
    return merged;
  } catch (err) {
    console.warn("Could not read saved data, starting fresh.", err);
    return DEFAULT_STATE();
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

/* ---------- rendering ---------- */

function render() {
  renderPeopleSelects();
  renderBanner();
  renderTeamStats();
  renderTodayProgress();
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
    el.className = "banner pre";
    el.innerHTML = `
      <div class="banner-top">Challenge starts in ${starts} day${starts === 1 ? "" : "s"}</div>
      <div class="banner-mission">Week 1 mission &middot; <strong>${fmt(dailyTarget(1))}</strong> push-ups per day</div>
      <div class="year-bar"><span style="width:0%"></span></div>
      <div class="banner-sub">Day 1 is ${state.config.start}</div>`;
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
  const nextTarget = dailyTarget(week + 1);

  el.className = "banner";
  el.innerHTML = `
    <div class="banner-top">
      <span class="day-num">Day ${day}</span><span class="day-of"> of ${TOTAL_DAYS}</span>
      <span class="banner-count">${left} day${left === 1 ? "" : "s"} left</span>
    </div>
    <div class="banner-mission">Week ${week} mission &middot; <strong>${fmt(target)}</strong> push-ups per person, per day</div>
    <div class="year-bar"><span style="width:${pct.toFixed(2)}%"></span></div>
    <div class="banner-sub">Day ${dayOfWeek} of 7 this week &middot; next week steps up to ${fmt(nextTarget)}/day</div>`;
}

function renderPeopleSelects() {
  const opts = state.people
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");

  const whoInput = document.getElementById("who-input");
  const prevWho = whoInput.value;
  whoInput.innerHTML = opts || `<option value="" disabled selected>Add a participant first</option>`;
  if (prevWho && state.people.some((p) => p.id === prevWho)) whoInput.value = prevWho;

  for (const id of ["chart-who", "history-who"]) {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = `<option value="__all__">Everyone</option>` + opts;
    if (prev && (prev === "__all__" || state.people.some((p) => p.id === prev))) sel.value = prev;
  }
}

function renderTeamStats() {
  document.getElementById("stat-team-total").textContent = fmt(repsFor(() => true));
  document.getElementById("stat-participants").textContent = state.people.length;
  document.getElementById("stat-today-total").textContent = fmt(repsFor((e) => e.date === todayStr()));

  const target = targetNow();
  const onTargetEl = document.getElementById("stat-ontarget");
  if (target == null || state.people.length === 0) {
    onTargetEl.textContent = "—";
  } else {
    const hit = state.people.filter((p) => todayForPerson(p.id) >= target).length;
    onTargetEl.textContent = `${hit}/${state.people.length}`;
  }
}

function renderTodayProgress() {
  const day = challengeDay();
  const people = Math.max(1, state.people.length);
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

function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (state.people.length === 0) {
    el.innerHTML = `<li class="empty">No participants yet.</li>`;
    return;
  }
  const target = targetNow();
  const rows = state.people
    .map((p) => ({
      name: p.name,
      total: totalForPerson(p.id),
      today: todayForPerson(p.id),
      streak: streakForPerson(p.id),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const max = Math.max(1, rows[0].total);
  const medals = ["🥇", "🥈", "🥉"];

  el.innerHTML = rows
    .map((r, i) => {
      const barPct = (r.total / max) * 100;
      const rank = medals[i] || `${i + 1}.`;
      const hit = target != null && r.today >= target;
      let meta;
      if (target != null) {
        meta = `${hit ? "✓ " : ""}${fmt(r.today)}/${fmt(target)} today`;
      } else {
        meta = r.today ? `+${fmt(r.today)} today` : "";
      }
      if (r.streak > 1) meta += ` · ${r.streak}d streak`;
      return `
      <li class="lb-row${hit ? " hit" : ""}">
        <span class="lb-rank">${rank}</span>
        <span class="lb-name">${escapeHtml(r.name)}</span>
        <span class="lb-bar"><span style="width:${barPct}%"></span></span>
        <span class="lb-total">${fmt(r.total)}</span>
        <span class="lb-meta muted">${meta}</span>
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
    per == null ? null : who === "__all__" ? per * Math.max(1, state.people.length) : per;
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
    .map(
      (p) => `
      <li>
        <span class="h-date">${escapeHtml(p.name)}</span>
        <span class="h-reps">${fmt(totalForPerson(p.id))}</span>
        <button class="h-del" data-person="${p.id}" title="Remove ${escapeHtml(p.name)}">✕</button>
      </li>`
    )
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
  state.people.push({ id: uid(), name: trimmed });
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
  state.entries.push({ id: uid(), personId, date: date || todayStr(), reps });
  save();
  render();
}

function removeEntry(id) {
  state.entries = state.entries.filter((e) => e.id !== id);
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

document.getElementById("date-input").value = todayStr();

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
  const btn = e.target.closest("button[data-person]");
  if (btn) removePerson(btn.dataset.person);
});

document.getElementById("history").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-entry]");
  if (btn) removeEntry(btn.dataset.entry);
});

document.getElementById("chart-who").addEventListener("change", renderChart);
document.getElementById("history-who").addEventListener("change", renderHistory);

/* settings dialog */
const goalDialog = document.getElementById("goal-dialog");
const cfgStart = document.getElementById("cfg-start");
const cfgBase = document.getElementById("cfg-base");
const cfgStep = document.getElementById("cfg-step");
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
  updateCfgPreview();
  goalDialog.showModal();
});
cfgBase.addEventListener("input", updateCfgPreview);
cfgStep.addEventListener("input", updateCfgPreview);

goalDialog.querySelector("form").addEventListener("submit", (e) => {
  // The form uses method="dialog"; it still closes itself after this handler.
  const action = e.submitter ? e.submitter.value : goalDialog.returnValue;
  if (action !== "save") return;
  state.config = {
    start: cfgStart.value || todayStr(),
    weekBase: Math.max(1, Math.floor(Number(cfgBase.value)) || 1),
    weekStep: Math.max(0, Math.floor(Number(cfgStep.value)) || 0),
  };
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

render();
