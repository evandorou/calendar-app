// ============================================================
// Config
// ============================================================
const API_BASE = window.API_BASE || "http://localhost:8000";

// ============================================================
// State
// ============================================================
const state = {
  organizations: [],
  users: [],
  teams: [],
  events: [],
  calendarDate: new Date(), // month currently shown
  calOrgFilter: "",
  calTeamFilter: "",
  userOrgFilter: "",
};

const ORG_COLOR_FALLBACK = "#5b7fdb";

// ============================================================
// Small helpers
// ============================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.style.background = isError ? "var(--accent-red)" : "var(--ink)";
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch (_) {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

function orgById(id) {
  return state.organizations.find((o) => o.id === id);
}
function userById(id) {
  return state.users.find((u) => u.id === id);
}
function teamById(id) {
  return state.teams.find((t) => t.id === id);
}

function toLocalInputValue(dateIso) {
  const d = new Date(dateIso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================
// Theme
// ============================================================
function initTheme() {
  const saved = localStorage.getItem("notebook-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("notebook-theme", next);
  });
}

// ============================================================
// Tabs
// ============================================================
function initTabs() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const section = tab.dataset.section;
      $$(".sheet").forEach((s) => s.classList.remove("active"));
      $(`#sec-${section}`).classList.add("active");
      $("#pageTitle").textContent = tab.querySelector("span").textContent;
      if (section === "calendar") renderCalendar();
    });
  });
}

// ============================================================
// API status indicator
// ============================================================
async function checkApiStatus() {
  const el = $("#apiStatus");
  try {
    await api("/");
    el.classList.add("ok");
    el.querySelector(".txt").textContent = "backend connected";
  } catch (e) {
    el.classList.remove("ok");
    el.querySelector(".txt").textContent = "backend offline";
  }
}

// ============================================================
// Load all data
// ============================================================
async function loadAll() {
  try {
    const [orgs, users, teams, events] = await Promise.all([
      api("/organizations"),
      api("/users"),
      api("/teams"),
      api("/events"),
    ]);
    state.organizations = orgs;
    state.users = users;
    state.teams = teams;
    state.events = events;
  } catch (e) {
    toast(`Could not load data: ${e.message}`, true);
    throw e;
  }
}

async function bootstrapDemoDataIfEmpty() {
  try {
    const orgs = await api("/organizations");
    if (orgs.length === 0) {
      await api("/seed", { method: "POST" });
    }
  } catch (_) {
    // backend not reachable yet — handled by checkApiStatus / toast
  }
}

// ============================================================
// Organizations
// ============================================================
function renderOrganizations() {
  const list = $("#orgList");
  list.innerHTML = "";
  if (state.organizations.length === 0) {
    list.innerHTML = `<p class="hint">No organizations yet — add one above.</p>`;
  }
  state.organizations.forEach((org) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.borderLeftColor = org.color || ORG_COLOR_FALLBACK;
    card.innerHTML = `
      <div class="card-actions">
        <button class="icon-btn" data-del-org="${org.id}" title="Delete organization">&times;</button>
      </div>
      <h3>${escapeHtml(org.name)}</h3>
      <p>${escapeHtml(org.description || "")}</p>
      <span class="tag">${org.user_count} member${org.user_count === 1 ? "" : "s"}</span>
    `;
    list.appendChild(card);
  });
  $$("[data-del-org]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this organization and all its users?")) return;
      try {
        await api(`/organizations/${btn.dataset.delOrg}`, { method: "DELETE" });
        toast("Organization deleted");
        await loadAll();
        renderAllSections();
      } catch (e) {
        toast(e.message, true);
      }
    })
  );
}

function populateOrgSelects() {
  const selects = [
    { el: $("#userForm [name=organization_id]"), placeholder: null },
    { el: $("#userOrgFilter"), placeholder: "All organizations" },
    { el: $("#calOrgFilter"), placeholder: "All orgs" },
    { el: $("#eventForm [name=organization_id]"), placeholder: "— none —" },
  ];
  selects.forEach(({ el, placeholder }) => {
    const currentVal = el.value;
    el.innerHTML = "";
    if (placeholder !== null) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = placeholder;
      el.appendChild(opt);
    }
    state.organizations.forEach((org) => {
      const opt = document.createElement("option");
      opt.value = org.id;
      opt.textContent = org.name;
      el.appendChild(opt);
    });
    if ([...el.options].some((o) => o.value === currentVal)) el.value = currentVal;
  });
}

function initOrgForm() {
  $("#orgForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api("/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          description: fd.get("description") || "",
          color: fd.get("color"),
        }),
      });
      e.target.reset();
      $("#orgForm [name=color]").value = "#5b7fdb";
      toast("Organization added");
      await loadAll();
      renderAllSections();
    } catch (e2) {
      toast(e2.message, true);
    }
  });
}

// ============================================================
// Users
// ============================================================
function renderUsers() {
  const list = $("#userList");
  list.innerHTML = "";
  const filtered = state.userOrgFilter
    ? state.users.filter((u) => u.organization_id === Number(state.userOrgFilter))
    : state.users;

  if (filtered.length === 0) {
    list.innerHTML = `<p class="hint">No users to show.</p>`;
  }
  filtered.forEach((user) => {
    const org = orgById(user.organization_id);
    const card = document.createElement("div");
    card.className = "card";
    card.style.borderLeftColor = org?.color || ORG_COLOR_FALLBACK;
    card.innerHTML = `
      <div class="card-actions">
        <button class="icon-btn" data-del-user="${user.id}" title="Delete user">&times;</button>
      </div>
      <h3>${escapeHtml(user.name)}</h3>
      <p>${escapeHtml(user.email)}</p>
      <p>${escapeHtml(user.role || "")}</p>
      <span class="tag">${escapeHtml(user.organization_name || "no org")}</span>
    `;
    list.appendChild(card);
  });
  $$("[data-del-user]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this user?")) return;
      try {
        await api(`/users/${btn.dataset.delUser}`, { method: "DELETE" });
        toast("User deleted");
        await loadAll();
        renderAllSections();
      } catch (e) {
        toast(e.message, true);
      }
    })
  );
}

function initUserForm() {
  $("#userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!fd.get("organization_id")) {
      toast("Add an organization first", true);
      return;
    }
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          role: fd.get("role") || "member",
          organization_id: Number(fd.get("organization_id")),
        }),
      });
      e.target.reset();
      toast("User added");
      await loadAll();
      renderAllSections();
    } catch (e2) {
      toast(e2.message, true);
    }
  });

  $("#userOrgFilter").addEventListener("change", (e) => {
    state.userOrgFilter = e.target.value;
    renderUsers();
  });
}

// ============================================================
// Teams
// ============================================================
function renderTeams() {
  const list = $("#teamList");
  list.innerHTML = "";
  if (state.teams.length === 0) {
    list.innerHTML = `<p class="hint">No teams yet — add one above.</p>`;
  }
  state.teams.forEach((team) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.borderLeftColor = team.color || "#2f8f5b";
    const orgTags = [...new Set(team.members.map((m) => m.organization_name).filter(Boolean))];
    card.innerHTML = `
      <div class="card-actions">
        <button class="icon-btn" data-manage-team="${team.id}" title="Manage members">&#9998;</button>
        <button class="icon-btn" data-del-team="${team.id}" title="Delete team">&times;</button>
      </div>
      <h3>${escapeHtml(team.name)}</h3>
      <p>${escapeHtml(team.description || "")}</p>
      <span class="tag">${team.members.length} member${team.members.length === 1 ? "" : "s"}</span>
      ${orgTags.map((o) => `<span class="tag">${escapeHtml(o)}</span>`).join("")}
    `;
    list.appendChild(card);
  });
  $$("[data-del-team]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this team?")) return;
      try {
        await api(`/teams/${btn.dataset.delTeam}`, { method: "DELETE" });
        toast("Team deleted");
        await loadAll();
        renderAllSections();
      } catch (e) {
        toast(e.message, true);
      }
    })
  );
  $$("[data-manage-team]").forEach((btn) =>
    btn.addEventListener("click", () => openTeamModal(Number(btn.dataset.manageTeam)))
  );
}

function initTeamForm() {
  $("#teamForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api("/teams", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          description: fd.get("description") || "",
          color: fd.get("color"),
          member_ids: [],
        }),
      });
      e.target.reset();
      $("#teamForm [name=color]").value = "#2f8f5b";
      toast("Team added");
      await loadAll();
      renderAllSections();
    } catch (e2) {
      toast(e2.message, true);
    }
  });
}

let activeTeamModalId = null;

function openTeamModal(teamId) {
  activeTeamModalId = teamId;
  const team = teamById(teamId);
  if (!team) return;
  $("#teamModalTitle").textContent = `${team.name} — members`;
  renderTeamModalMembers();

  const select = $("#teamModalUserSelect");
  const memberIds = new Set(team.members.map((m) => m.id));
  select.innerHTML = "";
  state.users
    .filter((u) => !memberIds.has(u.id))
    .forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.organization_name})`;
      select.appendChild(opt);
    });
  if (select.options.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No more users to add";
    opt.disabled = true;
    select.appendChild(opt);
  }
  $("#teamModalBackdrop").classList.add("open");
}

function renderTeamModalMembers() {
  const team = teamById(activeTeamModalId);
  const wrap = $("#teamModalMembers");
  wrap.innerHTML = "";
  if (!team || team.members.length === 0) {
    wrap.innerHTML = `<p class="hint">No members yet.</p>`;
    return;
  }
  const orgColors = {};
  state.organizations.forEach((o) => (orgColors[o.id] = o.color));
  team.members.forEach((m) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `
      <span class="org-dot" style="background:${orgColors[m.organization_id] || ORG_COLOR_FALLBACK}"></span>
      ${escapeHtml(m.name)} <span style="opacity:.6">· ${escapeHtml(m.organization_name || "")}</span>
      <button data-remove-member="${m.id}">&times;</button>
    `;
    wrap.appendChild(chip);
  });
  $$("[data-remove-member]", wrap).forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        const updated = await api(`/teams/${activeTeamModalId}/members/${btn.dataset.removeMember}`, {
          method: "DELETE",
        });
        const idx = state.teams.findIndex((t) => t.id === activeTeamModalId);
        state.teams[idx] = updated;
        renderTeamModalMembers();
        renderTeams();
      } catch (e) {
        toast(e.message, true);
      }
    })
  );
}

function initTeamModal() {
  $("#teamModalAddBtn").addEventListener("click", async () => {
    const select = $("#teamModalUserSelect");
    if (!select.value) return;
    try {
      const updated = await api(`/teams/${activeTeamModalId}/members/${select.value}`, { method: "POST" });
      const idx = state.teams.findIndex((t) => t.id === activeTeamModalId);
      state.teams[idx] = updated;
      openTeamModal(activeTeamModalId);
      renderTeams();
      toast("Member added");
    } catch (e) {
      toast(e.message, true);
    }
  });
}

// ============================================================
// Calendar
// ============================================================
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function initCalendarControls() {
  $("#calPrev").addEventListener("click", () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
    renderCalendar();
  });
  $("#calNext").addEventListener("click", () => {
    state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
    renderCalendar();
  });
  $("#calToday").addEventListener("click", () => {
    state.calendarDate = new Date();
    renderCalendar();
  });
  $("#calOrgFilter").addEventListener("change", (e) => {
    state.calOrgFilter = e.target.value;
    renderCalendar();
  });
  $("#calTeamFilter").addEventListener("change", (e) => {
    state.calTeamFilter = e.target.value;
    renderCalendar();
  });
  $("#newEventBtn").addEventListener("click", () => openEventModal());
}

function populateTeamSelects() {
  const selects = [
    { el: $("#calTeamFilter"), placeholder: "All teams" },
    { el: $("#eventForm [name=team_id]"), placeholder: "— none —" },
  ];
  selects.forEach(({ el, placeholder }) => {
    const currentVal = el.value;
    el.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    el.appendChild(opt0);
    state.teams.forEach((team) => {
      const opt = document.createElement("option");
      opt.value = team.id;
      opt.textContent = team.name;
      el.appendChild(opt);
    });
    if ([...el.options].some((o) => o.value === currentVal)) el.value = currentVal;
  });
}

function populateAttendeeSelect() {
  const select = $("#eventForm [name=attendee_ids]");
  select.innerHTML = "";
  state.users.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = `${u.name} (${u.organization_name})`;
    select.appendChild(opt);
  });
}

function filteredEvents() {
  return state.events.filter((ev) => {
    if (state.calOrgFilter && String(ev.organization_id) !== state.calOrgFilter) return false;
    if (state.calTeamFilter && String(ev.team_id) !== state.calTeamFilter) return false;
    return true;
  });
}

function renderCalendar() {
  const d = state.calendarDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  $("#calLabel").textContent = `${MONTH_NAMES[month]} ${year}`;

  const grid = $("#calGrid");
  grid.innerHTML = "";
  DOW.forEach((day) => {
    const el = document.createElement("div");
    el.className = "cal-dow";
    el.textContent = day;
    grid.appendChild(el);
  });

  const firstOfMonth = new Date(year, month, 1);
  const startDate = new Date(firstOfMonth);
  startDate.setDate(startDate.getDate() - firstOfMonth.getDay());

  const todayStr = new Date().toDateString();
  const events = filteredEvents();

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + i);
    const cell = document.createElement("div");
    cell.className = "cal-day";
    if (cellDate.getMonth() !== month) cell.classList.add("other-month");
    if (cellDate.toDateString() === todayStr) cell.classList.add("today");

    const dayEvents = events.filter((ev) => {
      const s = new Date(ev.start_time);
      return s.toDateString() === cellDate.toDateString();
    });

    cell.innerHTML = `<div class="daynum">${cellDate.getDate()}</div>`;
    dayEvents.slice(0, 3).forEach((ev) => {
      const chip = document.createElement("div");
      chip.className = "cal-event";
      chip.style.background = ev.color || "#2c4870";
      chip.textContent = ev.title;
      chip.title = `${ev.title} · ${new Date(ev.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        openEventModal(ev);
      });
      cell.appendChild(chip);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement("div");
      more.className = "cal-event";
      more.style.background = "var(--ink-soft)";
      more.textContent = `+${dayEvents.length - 3} more`;
      cell.appendChild(more);
    }

    cell.addEventListener("click", () => openEventModal(null, cellDate));
    grid.appendChild(cell);
  }
}

let editingEventId = null;

function openEventModal(event = null, defaultDate = null) {
  const form = $("#eventForm");
  form.reset();
  populateAttendeeSelect();
  editingEventId = event ? event.id : null;
  $("#eventModalTitle").textContent = event ? "Edit event" : "New event";
  $("#deleteEventBtn").style.display = event ? "inline-block" : "none";

  if (event) {
    form.id.value = event.id;
    form.title.value = event.title;
    form.description.value = event.description || "";
    form.location.value = event.location || "";
    form.start_time.value = toLocalInputValue(event.start_time);
    form.end_time.value = toLocalInputValue(event.end_time);
    form.organization_id.value = event.organization_id || "";
    form.team_id.value = event.team_id || "";
    form.color.value = event.color || "#2c4870";
    const attendeeIds = new Set(event.attendees.map((a) => a.id));
    Array.from(form.attendee_ids.options).forEach((opt) => {
      opt.selected = attendeeIds.has(Number(opt.value));
    });
  } else {
    const base = defaultDate ? new Date(defaultDate) : new Date();
    base.setHours(9, 0, 0, 0);
    const end = new Date(base);
    end.setHours(base.getHours() + 1);
    form.start_time.value = toLocalInputValue(base);
    form.end_time.value = toLocalInputValue(end);
  }
  $("#eventModalBackdrop").classList.add("open");
}

function initEventModal() {
  $("#eventForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const attendeeIds = Array.from(e.target.attendee_ids.selectedOptions).map((o) => Number(o.value));
    const payload = {
      title: fd.get("title"),
      description: fd.get("description") || "",
      location: fd.get("location") || "",
      start_time: new Date(fd.get("start_time")).toISOString(),
      end_time: new Date(fd.get("end_time")).toISOString(),
      color: fd.get("color"),
      organization_id: fd.get("organization_id") ? Number(fd.get("organization_id")) : null,
      team_id: fd.get("team_id") ? Number(fd.get("team_id")) : null,
      attendee_ids: attendeeIds,
    };
    try {
      if (editingEventId) {
        await api(`/events/${editingEventId}`, { method: "PUT", body: JSON.stringify(payload) });
        toast("Event updated");
      } else {
        await api("/events", { method: "POST", body: JSON.stringify(payload) });
        toast("Event created");
      }
      closeModals();
      await loadAll();
      renderCalendar();
    } catch (e2) {
      toast(e2.message, true);
    }
  });

  $("#deleteEventBtn").addEventListener("click", async () => {
    if (!editingEventId) return;
    if (!confirm("Delete this event?")) return;
    try {
      await api(`/events/${editingEventId}`, { method: "DELETE" });
      toast("Event deleted");
      closeModals();
      await loadAll();
      renderCalendar();
    } catch (e) {
      toast(e.message, true);
    }
  });
}

function closeModals() {
  $$(".modal-backdrop").forEach((m) => m.classList.remove("open"));
}

function initModalCloseHandlers() {
  $$(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModals();
    });
  });
  $$("[data-close]").forEach((btn) => btn.addEventListener("click", closeModals));
}

// ============================================================
// Utilities
// ============================================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ============================================================
// Master render / init
// ============================================================
function renderAllSections() {
  renderOrganizations();
  populateOrgSelects();
  renderUsers();
  renderTeams();
  populateTeamSelects();
  renderCalendar();
}

async function init() {
  initTheme();
  initTabs();
  initOrgForm();
  initUserForm();
  initTeamForm();
  initTeamModal();
  initEventModal();
  initModalCloseHandlers();
  initCalendarControls();

  await checkApiStatus();
  await bootstrapDemoDataIfEmpty();
  await loadAll();
  renderAllSections();
}

document.addEventListener("DOMContentLoaded", init);
