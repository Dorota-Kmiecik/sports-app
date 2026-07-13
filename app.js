const STORAGE_KEY = "forma-workout-journal-v1";

const state = loadState();
let activeView = "journal";
let modalMode = "month";
let toastTimer;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.months)) return saved;
  } catch (_) {}
  return { months: [], activeMonthId: null };
}

function saveState(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (message) showToast(message);
}

function emptyExercise(seriesCount = 3) {
  return { id: uid(), name: "", sets: Array.from({ length: seriesCount }, () => ({ reps: "", weight: "" })) };
}

function newDay(date) {
  return { id: uid(), date, seriesCount: 3, collapsed: false, exercises: Array.from({ length: 5 }, () => emptyExercise(3)) };
}

function localIsoDate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDate(dateString, options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("pl-PL", options).format(new Date(`${dateString}T12:00:00`));
}

function titleCase(value) { return value ? value[0].toUpperCase() + value.slice(1) : ""; }
function activeMonth() { return state.months.find(month => month.id === state.activeMonthId) || state.months[0]; }

function init() {
  $("#today-label").textContent = titleCase(formatDate(localIsoDate(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  bindStaticEvents();
  renderJournal();
}

function bindStaticEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  $("#add-month").addEventListener("click", () => openModal("month"));
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-cancel").addEventListener("click", closeModal);
  $("#modal-backdrop").addEventListener("click", event => { if (event.target === event.currentTarget) closeModal(); });
  $("#modal-form").addEventListener("submit", handleModalSubmit);
  $("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
  ["#progress-exercise", "#date-from", "#date-to", "#metric-select"].forEach(selector => $(selector).addEventListener("change", renderProgress));
}

function switchView(view) {
  activeView = view;
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `${view}-view`));
  $(".sidebar").classList.remove("open");
  if (view === "progress") setupProgressFilters();
}

function renderJournal() {
  renderMonthTabs();
  const container = $("#journal-content");
  const month = activeMonth();
  if (!month) {
    container.innerHTML = `<div class="empty-state"><div><span class="empty-icon"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M8 8h8M8 12h5"/></svg></span><h2>Zacznij swój dziennik</h2><p>Utwórz pierwszy folder miesiąca, a następnie dodaj dzień treningowy.</p><button class="primary-button" id="empty-add-month">＋ Utwórz miesiąc</button></div></div>`;
    $("#empty-add-month").addEventListener("click", () => openModal("month"));
    return;
  }

  const sortedDays = [...month.days].sort((a, b) => b.date.localeCompare(a.date));
  container.innerHTML = `
    <div class="month-title-row">
      <h2>${escapeHtml(month.name)}</h2>
      <div class="month-actions">
        <button class="icon-button" id="rename-month" aria-label="Zmień nazwę miesiąca" title="Zmień nazwę"><svg viewBox="0 0 24 24"><path d="m4 16-.8 4 4-.8L18 8.4 14.6 5 4 16Z"/><path d="m12.8 6.8 3.4 3.4"/></svg></button>
        <button class="icon-button danger-button" id="delete-month" aria-label="Usuń miesiąc" title="Usuń miesiąc"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button>
        <button class="primary-button" id="add-day">＋ Dodaj dzień</button>
      </div>
    </div>
    ${sortedDays.length ? `<div class="days-list">${sortedDays.map(renderDayCard).join("")}</div>` : `<div class="empty-state"><div><span class="empty-icon"><svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/><path d="M8 13h3M8 17h7"/></svg></span><h2>Ten miesiąc jest jeszcze pusty</h2><p>Dodaj dzień i zapisz swój pierwszy trening.</p><button class="primary-button" id="empty-add-day">＋ Dodaj dzień</button></div></div>`}
  `;
  bindJournalEvents();
}

function renderMonthTabs() {
  $("#month-tabs").innerHTML = state.months.map(month => `<button class="month-tab ${month.id === activeMonth()?.id ? "active" : ""}" data-month-id="${month.id}">${escapeHtml(month.name)}</button>`).join("");
  $$(".month-tab").forEach(button => button.addEventListener("click", () => { state.activeMonthId = button.dataset.monthId; saveState(); renderJournal(); }));
}

function renderDayCard(day) {
  const filledCount = day.exercises.filter(exercise => exercise.name.trim()).length;
  const seriesHeaders = Array.from({ length: day.seriesCount }, (_, index) => `<th>SERIA ${index + 1}<br><span>POWT. / KG</span></th>`).join("");
  return `<article class="day-card ${day.collapsed ? "collapsed" : ""}" data-day-id="${day.id}">
    <div class="day-header">
      <div class="day-header-main"><span class="day-number">${new Date(`${day.date}T12:00:00`).getDate()}</span><div><h3>${titleCase(formatDate(day.date, { weekday: "long" }))}</h3><p>${formatDate(day.date, { day: "numeric", month: "long", year: "numeric" })}</p></div></div>
      <div class="day-meta"><span class="exercise-count">${filledCount} ${plural(filledCount, "ćwiczenie", "ćwiczenia", "ćwiczeń")}</span><svg class="chevron" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></div>
    </div>
    <div class="workout-body">
      <table class="workout-table"><thead><tr><th>ĆWICZENIE</th>${seriesHeaders}<th></th></tr></thead><tbody>${day.exercises.map((exercise, row) => renderExerciseRow(exercise, row)).join("")}</tbody></table>
      <div class="table-actions"><button class="text-button add-exercise"><span>＋</span> Dodaj ćwiczenie</button><div><button class="text-button add-series"><span>＋</span> Dodaj serię</button><button class="text-button remove-day">Usuń dzień</button></div></div>
    </div>
  </article>`;
}

function renderExerciseRow(exercise, row) {
  return `<tr data-exercise-id="${exercise.id}">
    <td><input class="exercise-input" data-field="name" value="${escapeHtml(exercise.name)}" placeholder="${row < 5 ? `Ćwiczenie ${row + 1}` : "Nazwa ćwiczenia"}" /></td>
    ${exercise.sets.map((set, setIndex) => `<td><div class="set-pair"><input class="set-input" type="number" min="0" inputmode="numeric" data-set="${setIndex}" data-field="reps" value="${escapeHtml(set.reps)}" placeholder="powt." aria-label="Powtórzenia, seria ${setIndex + 1}"/><input class="set-input" type="number" min="0" step="0.5" inputmode="decimal" data-set="${setIndex}" data-field="weight" value="${escapeHtml(set.weight)}" placeholder="kg" aria-label="Ciężar, seria ${setIndex + 1}"/></div></td>`).join("")}
    <td><button class="delete-row" aria-label="Usuń ćwiczenie" title="Usuń wiersz">×</button></td>
  </tr>`;
}

function bindJournalEvents() {
  $("#add-day")?.addEventListener("click", () => openModal("day"));
  $("#empty-add-day")?.addEventListener("click", () => openModal("day"));
  $("#rename-month")?.addEventListener("click", () => openModal("rename"));
  $("#delete-month")?.addEventListener("click", deleteMonth);
  $$(".day-card").forEach(card => {
    const day = activeMonth().days.find(item => item.id === card.dataset.dayId);
    $(".day-header", card).addEventListener("click", () => { day.collapsed = !day.collapsed; saveState(); card.classList.toggle("collapsed"); });
    $$("input", card).forEach(input => input.addEventListener("input", () => updateWorkoutInput(day, input)));
    $(".add-exercise", card).addEventListener("click", () => { day.exercises.push(emptyExercise(day.seriesCount)); saveState(); renderJournal(); });
    $(".add-series", card).addEventListener("click", () => { day.seriesCount++; day.exercises.forEach(exercise => exercise.sets.push({ reps: "", weight: "" })); saveState(); renderJournal(); });
    $(".remove-day", card).addEventListener("click", () => deleteDay(day));
    $$(".delete-row", card).forEach(button => button.addEventListener("click", () => {
      if (day.exercises.length <= 5) return showToast("Tabela musi mieć co najmniej 5 wierszy");
      day.exercises = day.exercises.filter(exercise => exercise.id !== button.closest("tr").dataset.exerciseId); saveState("Usunięto wiersz"); renderJournal();
    }));
  });
}

function updateWorkoutInput(day, input) {
  const exercise = day.exercises.find(item => item.id === input.closest("tr").dataset.exerciseId);
  if (input.dataset.field === "name") exercise.name = input.value;
  else exercise.sets[Number(input.dataset.set)][input.dataset.field] = input.value;
  saveState();
}

function openModal(mode) {
  modalMode = mode;
  const month = activeMonth();
  const config = {
    month: ["Nowy miesiąc", "Nadaj nazwę folderowi, np. „Lipiec 2026”.", "Nazwa miesiąca", "Dodaj miesiąc"],
    rename: ["Zmień nazwę", "Nazwa będzie widoczna na liście Twoich folderów.", "Nowa nazwa", "Zapisz nazwę"],
    day: ["Nowy dzień treningowy", "Wybierz datę. Otrzymasz tabelę z 5 ćwiczeniami i 3 seriami.", "Notatka (opcjonalnie)", "Dodaj dzień"]
  }[mode];
  $("#modal-title").textContent = config[0]; $("#modal-description").textContent = config[1]; $("#modal-label").childNodes[0].textContent = config[2]; $("#modal-submit").textContent = config[3];
  $("#modal-input").required = mode !== "day"; $("#modal-input").value = mode === "rename" ? month.name : "";
  $("#modal-input").placeholder = mode === "day" ? "np. Trening góry ciała" : "np. Lipiec 2026";
  $("#modal-date-label").classList.toggle("hidden", mode !== "day"); $("#modal-date").required = mode === "day"; $("#modal-date").value = localIsoDate();
  $("#modal-backdrop").classList.add("open"); $("#modal-backdrop").setAttribute("aria-hidden", "false");
  setTimeout(() => (mode === "day" ? $("#modal-date") : $("#modal-input")).focus(), 30);
}

function closeModal() { $("#modal-backdrop").classList.remove("open"); $("#modal-backdrop").setAttribute("aria-hidden", "true"); }

function handleModalSubmit(event) {
  event.preventDefault();
  const value = $("#modal-input").value.trim();
  if (modalMode === "month") {
    const month = { id: uid(), name: value, days: [] }; state.months.push(month); state.activeMonthId = month.id; saveState("Utworzono nowy miesiąc");
  } else if (modalMode === "rename") { activeMonth().name = value; saveState("Nazwa została zmieniona"); }
  else {
    const date = $("#modal-date").value;
    if (activeMonth().days.some(day => day.date === date) && !confirm("W tym dniu istnieje już trening. Dodać kolejny?")) return;
    const day = newDay(date); day.note = value; activeMonth().days.push(day); saveState("Dodano dzień treningowy");
  }
  closeModal(); renderJournal();
}

function deleteMonth() {
  const month = activeMonth();
  if (!confirm(`Usunąć folder „${month.name}” i wszystkie jego treningi?`)) return;
  state.months = state.months.filter(item => item.id !== month.id); state.activeMonthId = state.months[0]?.id || null; saveState("Usunięto miesiąc"); renderJournal();
}

function deleteDay(day) {
  if (!confirm(`Usunąć trening z ${formatDate(day.date, { day: "numeric", month: "long" })}?`)) return;
  activeMonth().days = activeMonth().days.filter(item => item.id !== day.id); saveState("Usunięto dzień"); renderJournal();
}

function allWorkoutEntries() {
  return state.months.flatMap(month => month.days.flatMap(day => day.exercises.filter(ex => ex.name.trim()).map(exercise => ({ date: day.date, name: exercise.name.trim(), sets: exercise.sets }))));
}

function setupProgressFilters() {
  const entries = allWorkoutEntries();
  const names = [...new Set(entries.map(entry => entry.name))].sort((a, b) => a.localeCompare(b, "pl"));
  const select = $("#progress-exercise"); const previous = select.value;
  select.innerHTML = `<option value="all">Wszystkie ćwiczenia</option>${names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  if (names.includes(previous)) select.value = previous;
  const dates = entries.map(entry => entry.date).sort();
  if (!$("#date-from").value) $("#date-from").value = dates[0] || "";
  if (!$("#date-to").value) $("#date-to").value = dates.at(-1) || localIsoDate();
  renderProgress();
}

function filteredEntries() {
  const exercise = $("#progress-exercise").value, from = $("#date-from").value, to = $("#date-to").value;
  return allWorkoutEntries().filter(entry => (exercise === "all" || entry.name === exercise) && (!from || entry.date >= from) && (!to || entry.date <= to)).sort((a, b) => a.date.localeCompare(b.date));
}

function entryMetrics(entry) {
  const validSets = entry.sets.filter(set => Number(set.reps) > 0 || Number(set.weight) > 0);
  return {
    weight: Math.max(0, ...validSets.map(set => Number(set.weight) || 0)),
    sets: validSets.length,
    reps: validSets.reduce((sum, set) => sum + (Number(set.reps) || 0), 0),
    volume: validSets.reduce((sum, set) => sum + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0)
  };
}

function renderProgress() {
  const entries = filteredEntries();
  const metric = $("#metric-select").value;
  const metricNames = { weight: "Maksymalny ciężar", volume: "Objętość treningowa", sets: "Liczba serii", reps: "Liczba powtórzeń" };
  $("#chart-title").textContent = metricNames[metric];
  renderStats(entries);
  renderChart(entries, metric);
  renderInsights(entries);
  renderRecent(entries);
}

function renderStats(entries) {
  const uniqueDates = new Set(entries.map(entry => entry.date)).size;
  const metrics = entries.map(entryMetrics);
  const totalSets = metrics.reduce((sum, item) => sum + item.sets, 0);
  const totalVolume = metrics.reduce((sum, item) => sum + item.volume, 0);
  const maxWeight = Math.max(0, ...metrics.map(item => item.weight));
  const cards = [
    ["Treningi", uniqueDates, "dni z aktywnością", "M4 19V5M4 19h16M7 14l3-3 3 2 6-7"],
    ["Wykonane serie", totalSets, "łącznie w zakresie", "M5 7h14M5 12h14M5 17h9"],
    ["Największy ciężar", `${formatNumber(maxWeight)} kg`, "rekord w zakresie", "M7 8 12 3l5 5M12 3v14M5 21h14"],
    ["Objętość", `${formatCompact(totalVolume)} kg`, "ciężar × powtórzenia", "M4 17 9 8 4 3 7-6"]
  ];
  $("#stats-grid").innerHTML = cards.map(card => `<article class="stat-card"><div class="stat-label"><span>${card[0]}</span><span class="stat-icon"><svg viewBox="0 0 24 24"><path d="${card[3]}"/></svg></span></div><div class="stat-value">${card[1]}</div><div class="stat-detail">${card[2]}</div></article>`).join("");
}

function aggregateByDate(entries, metric) {
  const grouped = {};
  entries.forEach(entry => {
    const value = entryMetrics(entry)[metric];
    if (!grouped[entry.date]) grouped[entry.date] = [];
    grouped[entry.date].push(value);
  });
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({
    date,
    value: metric === "weight" ? Math.max(...values) : values.reduce((a, b) => a + b, 0)
  }));
}

function renderChart(entries, metric) {
  const points = aggregateByDate(entries, metric);
  const container = $("#chart-container"), change = $("#chart-change");
  if (!points.length) { container.innerHTML = `<div class="no-chart"><div>Brak danych dla wybranego zakresu.<br>Uzupełnij treningi w dzienniku.</div></div>`; change.textContent = "Brak danych"; change.className = "change-pill"; return; }
  const first = points[0].value, last = points.at(-1).value;
  const delta = first ? ((last - first) / first) * 100 : 0;
  change.textContent = `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% w zakresie`; change.className = `change-pill ${delta < 0 ? "negative" : ""}`;

  const width = 900, height = 270, left = 52, right = 22, top = 24, bottom = 38;
  const max = Math.max(...points.map(point => point.value), 1) * 1.15;
  const x = index => left + (points.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (points.length - 1));
  const y = value => top + (max - value) * (height - top - bottom) / max;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z`;
  const yLines = Array.from({ length: 5 }, (_, index) => { const value = max * (4 - index) / 4, yy = y(value); return `<line class="grid-line" x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}"/><text class="axis-label" x="${left-8}" y="${yy+3}" text-anchor="end">${formatCompact(value)}</text>`; }).join("");
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Wykres progresu"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c9675" stop-opacity=".24"/><stop offset="1" stop-color="#4c9675" stop-opacity="0"/></linearGradient></defs>${yLines}<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>${points.map((point,index) => `<circle class="chart-dot" cx="${x(index)}" cy="${y(point.value)}" r="4"/><text class="chart-value" x="${x(index)}" y="${y(point.value)-10}" text-anchor="middle">${formatCompact(point.value)}</text>${(index % labelEvery === 0 || index === points.length - 1) ? `<text class="axis-label" x="${x(index)}" y="${height-15}" text-anchor="middle">${formatDate(point.date, { day: "2-digit", month: "short" })}</text>` : ""}`).join("")}</svg>`;
}

function renderInsights(entries) {
  const points = aggregateByDate(entries, "weight");
  let title = "Zacznij budować swój progres";
  let text = "Dodaj pierwszy trening i uzupełnij serie. Gdy pojawią się dane, pokażemy tutaj najważniejszy wniosek z Twoich wyników.";
  if (points.length === 1) { title = "Pierwszy punkt odniesienia"; text = `Masz już zapisany trening. Kontynuuj regularne wpisy, aby zobaczyć kierunek zmian i porównać ciężary w czasie.`; }
  if (points.length > 1) {
    const diff = points.at(-1).value - points[0].value;
    title = diff >= 0 ? "Siła idzie w górę" : "Każdy trening daje informację";
    text = diff > 0 ? `Maksymalny ciężar wzrósł o ${formatNumber(diff)} kg w wybranym okresie. Utrzymuj regularność i zwiększaj obciążenie stopniowo.` : diff === 0 ? "Maksymalny ciężar jest stabilny. Sprawdź również objętość i liczbę powtórzeń — progres nie zawsze oznacza więcej kilogramów." : "Ciężar jest niższy niż na początku zakresu. Regeneracja i technika są równie ważne jak wynik — obserwuj trend w kolejnych treningach.";
  }
  $("#insight-card").innerHTML = `<span class="insight-icon"><svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.3 1.4-1.5 2.5h-4c-.2-1.1-.6-1.8-1.5-2.5Z"/></svg></span><h2>${title}</h2><p>${text}</p>`;
}

function renderRecent(entries) {
  const recent = [...entries].reverse().slice(0, 5);
  $("#recent-list").innerHTML = recent.length ? recent.map(entry => { const metrics = entryMetrics(entry); return `<div class="recent-item"><span class="recent-date">${formatDate(entry.date, { day: "2-digit", month: "short" })}</span><span class="recent-name">${escapeHtml(entry.name)}</span><span class="recent-result">${metrics.sets} ser. · ${formatNumber(metrics.weight)} kg</span></div>`; }).join("") : `<div class="no-data-small">Brak zapisanych ćwiczeń w tym zakresie.</div>`;
}

function plural(number, one, few, many) { if (number === 1) return one; if (number % 10 >= 2 && number % 10 <= 4 && (number % 100 < 10 || number % 100 >= 20)) return few; return many; }
function formatNumber(value) { return Number(value || 0).toLocaleString("pl-PL", { maximumFractionDigits: 1 }); }
function formatCompact(value) { return Intl.NumberFormat("pl-PL", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2200); }

init();
