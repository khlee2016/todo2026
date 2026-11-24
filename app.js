const STORAGE_KEY = "todo-calendar-items";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const TITLE_MAX = 120;
const NOTE_MAX = 500;

const board = document.getElementById("board");
const detail = document.getElementById("detail");
const periodLabel = document.getElementById("periodLabel");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let items = loadItems();
let view = "month";
let cursor = startOfDay(new Date());
let selected = formatDate(cursor);
let editingId = null;
let pendingDeleteId = null;
let saveMessage = "";
let shouldFocusTitle = false;

function loadItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isItem).map(normalizeItem);
  } catch {
    return [];
  }
}

function isItem(value) {
  return Boolean(value)
    && typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value.date);
}

function normalizeItem(value) {
  return {
    id: value.id,
    date: value.date,
    title: value.title.slice(0, TITLE_MAX),
    note: typeof value.note === "string" ? value.note.slice(0, NOTE_MAX) : "",
    done: Boolean(value.done),
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
  };
}

function commit(change) {
  const snapshot = items;
  items = change(items);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    saveMessage = "";
    return true;
  } catch {
    items = snapshot;
    saveMessage = "저장하지 못했습니다. 브라우저 저장 공간이 부족할 수 있습니다.";
    return false;
  }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return next;
}

function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function itemsFor(iso) {
  return items
    .filter((item) => item.date === iso)
    .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);
}

function uid() {
  if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function dowClass(day) {
  if (day === 0) return "sun";
  if (day === 6) return "sat";
  return "";
}

function periodText() {
  if (view === "day") {
    return `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 ${cursor.getDate()}일 ${WEEKDAYS[cursor.getDay()]}요일`;
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getDate()}일`;
    }
    if (sameYear) {
      return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getMonth() + 1}월 ${end.getDate()}일`;
    }
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getFullYear()}년 ${end.getMonth() + 1}월 ${end.getDate()}일`;
  }
  return `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
}

function shift(amount) {
  if (view === "month") cursor = addMonths(cursor, amount);
  else if (view === "week") cursor = addDays(cursor, amount * 7);
  else cursor = addDays(cursor, amount);
  selected = formatDate(cursor);
  closeItemEditors();
  render();
}

function goToday() {
  cursor = startOfDay(new Date());
  selected = formatDate(cursor);
  closeItemEditors();
  render();
}

function closeItemEditors() {
  editingId = null;
  pendingDeleteId = null;
}

function openDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso === selected) {
    if (window.matchMedia("(max-width: 980px)").matches) {
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }
  selected = iso;
  cursor = parseDate(iso);
  closeItemEditors();
  render();
  if (window.matchMedia("(max-width: 980px)").matches) {
    detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function render() {
  const focusedDate = document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.date || null
    : null;

  document.body.dataset.view = view;
  board.hidden = view === "day";
  const label = periodText();
  periodLabel.textContent = label;
  document.title = `${label} · 할 일`;

  const unit = view === "day" ? "날" : view === "week" ? "주" : "달";
  prevBtn.setAttribute("aria-label", `이전 ${unit}`);
  nextBtn.setAttribute("aria-label", `다음 ${unit}`);
  prevBtn.textContent = "이전";
  nextBtn.textContent = "다음";

  document.querySelectorAll(".views [data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  board.replaceChildren();
  if (view === "month") renderMonth();
  if (view === "week") renderWeek();
  renderDetail();

  if (shouldFocusTitle) {
    const title = document.getElementById("newTitle");
    if (title) title.focus();
    shouldFocusTitle = false;
  } else if (focusedDate) {
    const again = board.querySelector(`button[data-date="${focusedDate}"]`);
    if (again) again.focus();
  }
}

function renderMonth() {
  const month = cursor.getMonth();
  const grid = el("div", "month");
  WEEKDAYS.forEach((name, index) => {
    grid.append(el("div", `dow ${dowClass(index)}`, name));
  });

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const today = startOfDay(new Date());
  const weeks = [];
  for (let week = 0; week < 6; week += 1) {
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, week * 7 + index));
    if (days.some((day) => day.getMonth() === month)) weeks.push(days);
  }

  weeks.forEach((days) => {
    days.forEach((day) => {
      const iso = formatDate(day);
      const dayItems = itemsFor(iso);
      const button = el("button", "cell");
      button.type = "button";
      button.dataset.date = iso;
      if (day.getMonth() !== month) button.classList.add("is-outside");
      if (iso === selected) button.classList.add("is-selected");
      if (isSameDay(day, today)) button.classList.add("is-today");
      button.setAttribute("aria-pressed", iso === selected ? "true" : "false");
      button.setAttribute(
        "aria-label",
        `${day.getMonth() + 1}월 ${day.getDate()}일 ${WEEKDAYS[day.getDay()]}요일, 할 일 ${dayItems.length}개`
      );

      const num = el("span", `day-num ${dowClass(day.getDay())}`, String(day.getDate()));
      button.append(num);

      if (dayItems.length) {
        const badge = el("span", "mobile-count", String(dayItems.length));
        button.append(badge);
        const chips = el("span", "chips");
        dayItems.slice(0, 3).forEach((item) => {
          const chip = el("span", item.done ? "chip is-done" : "chip", item.title);
          if (item.note) chip.title = item.note;
          chips.append(chip);
        });
        if (dayItems.length > 3) chips.append(el("span", "more", `+${dayItems.length - 3}`));
        button.append(chips);
      }
      grid.append(button);
    });
  });

  board.append(grid);
}

function renderWeek() {
  const wrap = el("div", "week-board");
  const start = startOfWeek(cursor);
  const today = startOfDay(new Date());

  for (let index = 0; index < 7; index += 1) {
    const day = addDays(start, index);
    const iso = formatDate(day);
    const dayItems = itemsFor(iso);
    const column = el("article", "week-day");
    column.dataset.date = iso;
    if (iso === selected) column.classList.add("is-selected");
    if (isSameDay(day, today)) column.classList.add("is-today");

    const head = el("button", "week-head");
    head.type = "button";
    head.dataset.date = iso;
    const showMonth = index === 0 || day.getDate() === 1;
    head.setAttribute(
      "aria-label",
      `${day.getMonth() + 1}월 ${day.getDate()}일 ${WEEKDAYS[day.getDay()]}요일, 할 일 ${dayItems.length}개`
    );
    head.append(el("span", `week-dow ${dowClass(day.getDay())}`, WEEKDAYS[day.getDay()]));
    head.append(el(
      "span",
      `week-num ${dowClass(day.getDay())}`,
      showMonth ? `${day.getMonth() + 1}/${day.getDate()}` : String(day.getDate())
    ));
    column.append(head);

    if (!dayItems.length) {
      column.append(el("p", "week-empty", "없음"));
    } else {
      const list = el("ul", "week-list");
      dayItems.forEach((item) => {
        const li = el("li", item.done ? "week-item is-done" : "week-item", item.title);
        if (item.note) li.title = item.note;
        list.append(li);
      });
      column.append(list);
    }
    wrap.append(column);
  }
  board.append(wrap);
}

function renderDetail() {
  const date = parseDate(selected);
  const list = itemsFor(selected);
  const doneCount = list.filter((item) => item.done).length;
  detail.replaceChildren();

  detail.append(el(
    "h2",
    null,
    `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`
  ));
  detail.append(el(
    "p",
    "summary",
    list.length ? `할 일 ${list.length}개 · 완료 ${doneCount}개` : "등록된 할 일이 없습니다"
  ));

  const form = el("form", "add-form");
  form.id = "addForm";
  form.autocomplete = "off";
  const row = el("div", "add-row");
  const title = el("input");
  title.id = "newTitle";
  title.name = "title";
  title.type = "text";
  title.maxLength = TITLE_MAX;
  title.placeholder = "새 할 일";
  title.setAttribute("aria-label", "새 할 일");
  const addButton = el("button", "btn", "추가");
  addButton.type = "submit";
  row.append(title, addButton);
  const note = el("textarea");
  note.name = "note";
  note.maxLength = NOTE_MAX;
  note.rows = 2;
  note.placeholder = "메모 (선택)";
  note.setAttribute("aria-label", "메모");
  form.append(row, note, el("p", "form-error"));
  detail.append(form);

  if (!list.length) {
    detail.append(el("p", "empty", "이 날짜를 선택하면 할 일을 확인하고, 추가하고, 고치거나 지울 수 있습니다."));
  } else {
    const ul = el("ul", "todo-list");
    let divided = false;
    list.forEach((item) => {
      if (item.done && !divided && list.some((entry) => !entry.done)) {
        divided = true;
        ul.append(el("li", "divider", "완료"));
      }
      ul.append(renderTodo(item));
    });
    detail.append(ul);
  }

  const hint = el("p", saveMessage ? "save-hint is-error" : "save-hint", saveMessage || "이 브라우저의 로컬 저장소에 보관됩니다.");
  detail.append(hint);
}

function renderTodo(item) {
  const li = el("li", "todo");
  if (item.done) li.classList.add("is-done");

  if (editingId === item.id) {
    li.classList.add("is-editing");
    const form = el("form", "edit-form");
    form.dataset.id = item.id;
    form.autocomplete = "off";
    const title = el("input");
    title.name = "title";
    title.type = "text";
    title.maxLength = TITLE_MAX;
    title.value = item.title;
    title.setAttribute("aria-label", "할 일 수정");
    const note = el("textarea");
    note.name = "note";
    note.maxLength = NOTE_MAX;
    note.rows = 2;
    note.value = item.note;
    note.setAttribute("aria-label", "메모 수정");
    const date = el("input");
    date.name = "due";
    date.type = "date";
    date.value = item.date;
    date.setAttribute("aria-label", "날짜 변경");
    const actions = el("div", "edit-actions");
    const save = el("button", "btn", "저장");
    save.type = "submit";
    const cancel = el("button", "btn ghost", "취소");
    cancel.type = "button";
    cancel.dataset.action = "cancel-edit";
    cancel.dataset.id = item.id;
    actions.append(cancel, save);
    form.append(title, note, date, el("p", "form-error"), actions);
    li.append(form);
    return li;
  }

  if (pendingDeleteId === item.id) {
    li.classList.add("is-confirm");
    const box = el("div", "confirm-box");
    box.append(el("p", "confirm-title", item.title));
    box.append(el("p", "confirm-copy", "삭제하면 복구할 수 없습니다."));
    const actions = el("div", "confirm-actions");
    const cancel = el("button", "btn ghost", "취소");
    cancel.type = "button";
    cancel.dataset.action = "cancel-delete";
    cancel.dataset.id = item.id;
    const confirm = el("button", "btn danger", "삭제");
    confirm.type = "button";
    confirm.dataset.action = "confirm-delete";
    confirm.dataset.id = item.id;
    actions.append(cancel, confirm);
    box.append(actions);
    li.append(box);
    return li;
  }

  const label = el("label", "check");
  const checkbox = el("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.done;
  checkbox.dataset.action = "toggle";
  checkbox.dataset.id = item.id;
  checkbox.setAttribute("aria-label", `${item.title} 완료`);
  label.append(checkbox);

  const body = el("div", "todo-body");
  body.append(el("p", "todo-title", item.title));
  if (item.note) body.append(el("p", "todo-note", item.note));

  const actions = el("div", "todo-actions");
  const edit = el("button", "text-btn", "수정");
  edit.type = "button";
  edit.dataset.action = "edit";
  edit.dataset.id = item.id;
  const remove = el("button", "text-btn danger", "삭제");
  remove.type = "button";
  remove.dataset.action = "delete";
  remove.dataset.id = item.id;
  actions.append(edit, remove);
  li.append(label, body, actions);
  return li;
}

function field(form, name) {
  return form.querySelector(`[name="${name}"]`);
}

function onAdd(form) {
  const title = field(form, "title").value.trim().slice(0, TITLE_MAX);
  const note = field(form, "note").value.trim().slice(0, NOTE_MAX);
  const error = form.querySelector(".form-error");
  if (!title) {
    error.textContent = "할 일을 입력해 주세요.";
    field(form, "title").focus();
    return;
  }
  const item = {
    id: uid(),
    date: selected,
    title,
    note,
    done: false,
    createdAt: Date.now(),
  };
  const ok = commit((list) => [item, ...list]);
  if (ok) shouldFocusTitle = true;
  render();
}

function onSave(form) {
  const id = form.dataset.id;
  const current = items.find((item) => item.id === id);
  if (!current) return;
  const title = field(form, "title").value.trim().slice(0, TITLE_MAX);
  const note = field(form, "note").value.trim().slice(0, NOTE_MAX);
  const due = field(form, "due").value;
  const error = form.querySelector(".form-error");
  if (!title) {
    error.textContent = "할 일을 입력해 주세요.";
    field(form, "title").focus();
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    error.textContent = "날짜를 확인해 주세요.";
    return;
  }
  const ok = commit((list) => list.map((item) => (
    item.id === id ? { ...item, title, note, date: due } : item
  )));
  if (!ok) {
    render();
    return;
  }
  editingId = null;
  if (due !== selected) {
    selected = due;
    cursor = parseDate(due);
  }
  render();
}

function onBoardClick(event) {
  const target = event.target.closest("[data-date]");
  if (!target || !board.contains(target)) return;
  openDate(target.dataset.date);
}

function onDetailClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || !detail.contains(button) || button.dataset.action === "toggle") return;
  const id = button.dataset.id;
  if (button.dataset.action === "edit") {
    editingId = id;
    pendingDeleteId = null;
    render();
    const input = detail.querySelector(".edit-form [name='title']");
    if (input) input.focus();
    return;
  }
  if (button.dataset.action === "cancel-edit") {
    editingId = null;
    render();
    return;
  }
  if (button.dataset.action === "delete") {
    pendingDeleteId = id;
    editingId = null;
    render();
    return;
  }
  if (button.dataset.action === "cancel-delete") {
    pendingDeleteId = null;
    render();
    return;
  }
  if (button.dataset.action === "confirm-delete") {
    const ok = commit((list) => list.filter((item) => item.id !== id));
    pendingDeleteId = null;
    if (ok) editingId = null;
    render();
  }
}

function onDetailChange(event) {
  const input = event.target.closest("[data-action='toggle']");
  if (!input || !detail.contains(input)) return;
  const id = input.dataset.id;
  const done = input.checked;
  commit((list) => list.map((item) => (item.id === id ? { ...item, done } : item)));
  render();
}

function onDetailSubmit(event) {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !detail.contains(form)) return;
  if (form.id === "addForm") onAdd(form);
  else if (form.classList.contains("edit-form")) onSave(form);
}

function onViewClick(event) {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  view = button.dataset.view;
  closeItemEditors();
  render();
}

function onKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const tag = event.target && event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    shift(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    shift(1);
  }
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  items = loadItems();
  closeItemEditors();
  render();
});

prevBtn.addEventListener("click", () => shift(-1));
nextBtn.addEventListener("click", () => shift(1));
document.getElementById("todayBtn").addEventListener("click", goToday);
document.querySelector(".views").addEventListener("click", onViewClick);
board.addEventListener("click", onBoardClick);
detail.addEventListener("click", onDetailClick);
detail.addEventListener("change", onDetailChange);
detail.addEventListener("submit", onDetailSubmit);
document.addEventListener("keydown", onKeydown);

render();
