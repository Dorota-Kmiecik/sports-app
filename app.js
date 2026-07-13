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
  return { id: uid(), name: "", sets: Array.from({ length: seriesCount }, () => ({ reps: "", weight: "", effort: "" })) };
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
  $("#mobile-menu").addEventListener("click", () => setMobileMenu(!$(".sidebar").classList.contains("open")));
  $("#mobile-close").addEventListener("click", () => setMobileMenu(false));
  $("#sidebar-overlay").addEventListener("click", () => setMobileMenu(false));
  document.addEventListener("keydown", event => { if (event.key === "Escape") { closeModal(); setMobileMenu(false); } });
  ["#date-from", "#date-to"].forEach(selector => $(selector).addEventListener("change", renderProgress));
}

function setMobileMenu(open) {
  $(".sidebar").classList.toggle("open", open);
  $("#sidebar-overlay").classList.toggle("open", open);
  $("#mobile-menu").setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
}

function switchView(view) {
  activeView = view;
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `${view}-view`));
  setMobileMenu(false);
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
      <div class="effort-help"><strong>Dotykaj „Oznacz”, aby zmieniać kolor:</strong><span><i class="effort-dot green"></i>duży zapas</span><span><i class="effort-dot orange"></i>mały zapas</span><span><i class="effort-dot red"></i>ledwo ukończona</span></div>
      <div class="table-actions"><button class="text-button add-exercise"><span>＋</span> Dodaj ćwiczenie</button><div><button class="text-button add-series"><span>＋</span> Dodaj serię</button><button class="text-button remove-day">Usuń dzień</button></div></div>
    </div>
  </article>`;
}

function renderExerciseRow(exercise, row) {
  return `<tr data-exercise-id="${exercise.id}">
    <td><input class="exercise-input" data-field="name" value="${escapeHtml(exercise.name)}" placeholder="${row < 5 ? `Ćwiczenie ${row + 1}` : "Nazwa ćwiczenia"}" /></td>
    ${exercise.sets.map((set, setIndex) => `<td class="set-cell ${set.effort ? `effort-${set.effort}` : ""}"><div class="set-pair"><input class="set-input" type="number" min="0" inputmode="numeric" data-set="${setIndex}" data-field="reps" value="${escapeHtml(set.reps)}" placeholder="powt." aria-label="Powtórzenia, seria ${setIndex + 1}"/><input class="set-input" type="number" min="0" step="0.5" inputmode="decimal" data-set="${setIndex}" data-field="weight" value="${escapeHtml(set.weight)}" placeholder="kg" aria-label="Ciężar, seria ${setIndex + 1}"/></div><div class="effort-picker"><button class="effort-cycle ${set.effort || "empty"}" data-set="${setIndex}" type="button" title="Dotknij, aby zmienić odczucie" aria-label="Seria ${setIndex + 1}: ${effortName(set.effort)}. Dotknij, aby zmienić"><i></i><span>${effortShortName(set.effort)}</span></button></div></td>`).join("")}
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
    $(".add-series", card).addEventListener("click", () => { day.seriesCount++; day.exercises.forEach(exercise => exercise.sets.push({ reps: "", weight: "", effort: "" })); saveState(); renderJournal(); });
    $(".remove-day", card).addEventListener("click", () => deleteDay(day));
    $$(".delete-row", card).forEach(button => button.addEventListener("click", () => {
      if (day.exercises.length <= 5) return showToast("Tabela musi mieć co najmniej 5 wierszy");
      day.exercises = day.exercises.filter(exercise => exercise.id !== button.closest("tr").dataset.exerciseId); saveState("Usunięto wiersz"); renderJournal();
    }));
    $$(".effort-cycle", card).forEach(button => button.addEventListener("click", () => {
      const exercise = day.exercises.find(item => item.id === button.closest("tr").dataset.exerciseId);
      const set = exercise.sets[Number(button.dataset.set)];
      const cycle = ["", "green", "orange", "red"];
      set.effort = cycle[(cycle.indexOf(set.effort || "") + 1) % cycle.length];
      saveState("Zapisano odczucie po serii"); renderJournal();
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
  const dates = entries.map(entry => entry.date).sort();
  if (!$("#date-from").value) $("#date-from").value = dates[0] || "";
  if (!$("#date-to").value) $("#date-to").value = dates.at(-1) || localIsoDate();
  renderProgress();
}

function filteredEntries() {
  const from = $("#date-from").value, to = $("#date-to").value;
  return allWorkoutEntries().filter(entry => (!from || entry.date >= from) && (!to || entry.date <= to)).sort((a, b) => a.date.localeCompare(b.date));
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
  renderStats(entries);
  renderExerciseProgress(entries);
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

function renderExerciseProgress(entries) {
  const container = $("#exercise-progress-list");
  const groups = new Map();
  entries.forEach(entry => {
    const key = entry.name.toLocaleLowerCase("pl-PL");
    if (!groups.has(key)) groups.set(key, { name: entry.name, entries: [] });
    groups.get(key).entries.push(entry);
  });
  const exercises = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  if (!exercises.length) {
    container.innerHTML = `<article class="chart-card empty-progress"><div class="no-chart"><div>Brak danych dla wybranego zakresu.<br>Uzupełnij ćwiczenia, serie i ciężary w dzienniku.</div></div></article>`;
    return;
  }
  container.innerHTML = exercises.map((exercise, index) => {
    const weightPoints = aggregateByDate(exercise.entries, "weight");
    const setPoints = aggregateByDate(exercise.entries, "sets");
    const weightChange = metricChange(weightPoints, "kg");
    const setChange = metricChange(setPoints, "ser.");
    return `<article class="exercise-progress-card">
      <div class="exercise-progress-header"><div><span class="exercise-index">${String(index + 1).padStart(2, "0")}</span><div><span class="card-kicker">PROGRES ĆWICZENIA</span><h2>${escapeHtml(exercise.name)}</h2></div></div><span class="entry-count">${exercise.entries.length} ${plural(exercise.entries.length, "wpis", "wpisy", "wpisów")}</span></div>
      <div class="exercise-charts">
        <section class="metric-chart"><div class="metric-chart-header"><div><span class="metric-mark weight"></span><strong>Maksymalny ciężar</strong><small>największy ciężar użyty danego dnia</small></div><span class="change-pill ${weightChange.negative ? "negative" : ""}">${weightChange.label}</span></div><div class="chart-container mini-chart">${buildChartSvg(weightPoints, "kg", `Ciężar dla ${exercise.name}`, "weight")}</div></section>
        <section class="metric-chart"><div class="metric-chart-header"><div><span class="metric-mark sets"></span><strong>Wykonane serie</strong><small>liczba uzupełnionych serii danego dnia</small></div><span class="change-pill ${setChange.negative ? "negative" : ""}">${setChange.label}</span></div><div class="chart-container mini-chart">${buildChartSvg(setPoints, "ser.", `Serie dla ${exercise.name}`, "sets")}</div></section>
      </div>
    </article>`;
  }).join("");
}

function metricChange(points, unit) {
  if (!points.length) return { label: "Brak danych", negative: false };
  const difference = points.at(-1).value - points[0].value;
  return { label: `${difference > 0 ? "+" : ""}${formatNumber(difference)} ${unit}`, negative: difference < 0 };
}

function buildChartSvg(points, unit, ariaLabel, variant) {
  if (!points.length || points.every(point => point.value === 0)) return `<div class="no-chart"><div>Brak uzupełnionych danych</div></div>`;
  const width = 520, height = 230, left = 45, right = 18, top = 27, bottom = 38;
  const max = Math.max(...points.map(point => point.value), 1) * 1.18;
  const x = index => left + (points.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (points.length - 1));
  const y = value => top + (max - value) * (height - top - bottom) / max;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z`;
  const grid = Array.from({ length: 4 }, (_, index) => { const value = max * (3 - index) / 3, yy = y(value); return `<line class="grid-line" x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}"/><text class="axis-label" x="${left-7}" y="${yy+3}" text-anchor="end">${formatCompact(value)}</text>`; }).join("");
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  const gradientId = `gradient-${variant}-${uid()}`;
  return `<svg class="${variant}-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ariaLabel)}"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-opacity=".22"/><stop offset="1" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" style="fill:url(#${gradientId})" d="${area}"/><path class="chart-line" d="${path}"/>${points.map((point,index) => `<circle class="chart-dot" cx="${x(index)}" cy="${y(point.value)}" r="4"/><text class="chart-value" x="${x(index)}" y="${y(point.value)-9}" text-anchor="middle">${formatNumber(point.value)} ${unit}</text>${(index % labelEvery === 0 || index === points.length - 1) ? `<text class="axis-label" x="${x(index)}" y="${height-15}" text-anchor="middle">${formatDate(point.date, { day: "2-digit", month: "short" })}</text>` : ""}`).join("")}</svg>`;
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
function effortName(effort) { return ({ green: "duży zapas", orange: "mały zapas", red: "ledwo ukończona" })[effort] || "bez oznaczenia"; }
function effortShortName(effort) { return ({ green: "Zapas", orange: "Trochę", red: "Granica" })[effort] || "Oznacz"; }
function formatNumber(value) { return Number(value || 0).toLocaleString("pl-PL", { maximumFractionDigits: 1 }); }
function formatCompact(value) { return Intl.NumberFormat("pl-PL", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2200); }

init();
