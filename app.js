/* The Push-Up Challenge — local multi-participant tracker.
 * State lives in localStorage under STORAGE_KEY. No network calls. */

const STORAGE_KEY = "pushup-challenge:v1";
const CHART_DAYS = 30;

const DEFAULT_STATE = () => ({
  people: [],                 // [{ id, name }]
  entries: [],                // [{ id, personId, date: "YYYY-MM-DD", reps }]
  goal: { type: "team-total", amount: 10000, start: todayStr() },
});

let state = load();

/* ---------- persistence ---------- */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE(), ...parsed, goal: { ...DEFAULT_STATE().goal, ...(parsed.goal || {}) } };
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

/* ---------- helpers ---------- */

function todayStr(d = new Date()) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function personName(id) {
  const p = state.people.find((x) => x.id === id);
  return p ? p.name : "(removed)";
}

function repsFor(predicate) {
  return state.entries.filter(predicate).reduce((sum, e) => sum + e.reps, 0);
}

function totalForPerson(id) {
  return repsFor((e) => e.personId === id);
}

function bestDayForPerson(id) {
  const byDay = {};
  for (const e of state.entries) {
    if (e.personId !== id) continue;
    byDay[e.date] = (byDay[e.date] || 0) + e.reps;
  }
  return Object.values(byDay).reduce((m, v) => Math.max(m, v), 0);
}

function streakForPerson(id) {
  const days = new Set(
    state.entries.filter((e) => e.personId === id && e.reps > 0).map((e) => e.date)
  );
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to be "alive" if they logged today or yesterday.
  if (!days.has(todayStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(todayStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function daysIn() {
  const start = new Date(state.goal.start + "T00:00:00");
  const now = new Date(todayStr() + "T00:00:00");
  const diff = Math.floor((now - start) / 86400000) + 1;
  return Math.max(1, diff);
}

/* ---------- rendering ---------- */

function render() {
  renderPeopleSelects();
  renderTeamStats();
  renderGoal();
  renderLeaderboard();
  renderChart();
  renderPeopleList();
  renderHistory();
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
  document.getElementById("stat-today-total").textContent = fmt(
    repsFor((e) => e.date === todayStr())
  );
  document.getElementById("stat-days").textContent = daysIn();
}

function renderGoal() {
  const { type, amount } = state.goal;
  const people = Math.max(1, state.people.length);
  let current = 0;
  let target = amount;
  let label = "";

  if (type === "team-total") {
    current = repsFor(() => true);
    target = amount;
    label = `${fmt(current)} / ${fmt(target)} team reps`;
  } else if (type === "per-person-total") {
    target = amount * people;
    current = repsFor(() => true);
    label = `${fmt(current)} / ${fmt(target)} reps (${fmt(amount)} each × ${people})`;
  } else if (type === "per-person-daily") {
    target = amount * people * daysIn();
    current = repsFor(() => true);
    label = `${fmt(current)} / ${fmt(target)} reps (${fmt(amount)}/person/day × ${daysIn()} days)`;
  }

  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  document.getElementById("goal-detail").textContent = label;
  document.getElementById("progress-fill").style.width = pct.toFixed(1) + "%";
}

function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (state.people.length === 0) {
    el.innerHTML = `<li class="empty">No participants yet.</li>`;
    return;
  }
  const rows = state.people
    .map((p) => ({
      name: p.name,
      total: totalForPerson(p.id),
      today: repsFor((e) => e.personId === p.id && e.date === todayStr()),
      streak: streakForPerson(p.id),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const max = Math.max(1, rows[0].total);
  const medals = ["🥇", "🥈", "🥉"];

  el.innerHTML = rows
    .map((r, i) => {
      const barPct = (r.total / max) * 100;
      const rank = medals[i] || `${i + 1}.`;
      return `
      <li class="lb-row">
        <span class="lb-rank">${rank}</span>
        <span class="lb-name">${escapeHtml(r.name)}</span>
        <span class="lb-bar"><span style="width:${barPct}%"></span></span>
        <span class="lb-total">${fmt(r.total)}</span>
        <span class="lb-meta muted">${r.today ? "+" + fmt(r.today) + " today" : ""}${
        r.streak > 1 ? ` · ${r.streak}d streak` : ""
      }</span>
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
  const max = Math.max(1, ...days.map((d) => d.reps));
  const chart = document.getElementById("chart");
  chart.innerHTML = days
    .map((d) => {
      const h = (d.reps / max) * 100;
      const cls =
        "bar" + (d.reps > 0 ? " has-value" : "") + (d.ds === todayStr() ? " today" : "");
      return `<div class="${cls}" style="height:${Math.max(2, h)}%" title="${d.ds}: ${fmt(
        d.reps
      )}"></div>`;
    })
    .join("");
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
        <button class="h-del" data-person="${p.id}" title="Remove ${escapeHtml(
        p.name
      )}">✕</button>
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
  return n.toLocaleString();
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
      state = { ...DEFAULT_STATE(), ...data, goal: { ...DEFAULT_STATE().goal, ...(data.goal || {}) } };
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

/* goal dialog */
const goalDialog = document.getElementById("goal-dialog");
document.getElementById("edit-goal").addEventListener("click", () => {
  document.getElementById("goal-type").value = state.goal.type;
  document.getElementById("goal-amount").value = state.goal.amount;
  document.getElementById("goal-start").value = state.goal.start;
  goalDialog.showModal();
});
goalDialog.addEventListener("close", () => {
  if (goalDialog.returnValue !== "save") return;
  const type = document.getElementById("goal-type").value;
  const amount = Math.max(1, Math.floor(Number(document.getElementById("goal-amount").value)));
  const start = document.getElementById("goal-start").value || todayStr();
  state.goal = { type, amount, start };
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
  if (!confirm("Erase all participants, sets, and goal settings?")) return;
  state = DEFAULT_STATE();
  save();
  render();
});

render();
