const DATA_URL = "data/cases.json";

const CATEGORY_LABELS = {
  immigration: "Immigration",
  intellectual_property: "Intellectual property",
  criminal: "Criminal",
  constitutional_law: "Constitutional law",
  civil_rights: "Civil rights",
  labor_employment: "Labor & employment",
  environmental: "Environmental",
  tax: "Tax",
  antitrust_business: "Antitrust & business",
  family_law: "Family law",
  bankruptcy: "Bankruptcy",
  uncategorized: "Uncategorized",
};

let ALL_CASES = [];
let state = { category: null, court: null, search: "" };

function fmtDuration(seconds) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return "Date unknown";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    document.getElementById("loading-state").innerHTML =
      `<p>Couldn't load data/cases.json. Run export_static.py after ingesting data, and make sure it's committed.</p>`;
    return;
  }
  ALL_CASES = await res.json();
  document.getElementById("loading-state").hidden = true;
  buildSidebar();
  renderCases();
}

function buildSidebar() {
  const catCounts = {};
  const courtCounts = {};
  ALL_CASES.forEach((c) => {
    (c.categories || []).forEach((cat) => {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    if (c.court_id) courtCounts[c.court_id] = (courtCounts[c.court_id] || 0) + 1;
  });

  const catList = document.getElementById("category-list");
  catList.innerHTML = `<li><button data-cat="">All subjects</button></li>`;
  Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, n]) => {
      const label = CATEGORY_LABELS[cat] || cat;
      catList.innerHTML += `<li><button data-cat="${cat}">${label}<span class="filter-count">${n}</span></button></li>`;
    });
  catList.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.cat || null;
      renderActiveFilters();
      renderCases();
    });
  });

  const courtList = document.getElementById("court-list");
  courtList.innerHTML = `<li><button data-court="">All courts</button></li>`;
  Object.entries(courtCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([court, n]) => {
      courtList.innerHTML += `<li><button data-court="${court}">${court.toUpperCase()}<span class="filter-count">${n}</span></button></li>`;
    });
  courtList.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.court = btn.dataset.court || null;
      renderActiveFilters();
      renderCases();
    });
  });

  renderActiveFilters();
}

function renderActiveFilters() {
  document.querySelectorAll("#category-list button").forEach((btn) => {
    btn.classList.toggle("active", (btn.dataset.cat || null) === state.category);
  });
  document.querySelectorAll("#court-list button").forEach((btn) => {
    btn.classList.toggle("active", (btn.dataset.court || null) === state.court);
  });
}

function filteredCases() {
  const q = state.search.toLowerCase();
  return ALL_CASES.filter((c) => {
    if (state.category && !(c.categories || []).includes(state.category)) return false;
    if (state.court && c.court_id !== state.court) return false;
    if (q) {
      const haystack = `${c.case_name} ${c.transcript_text || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function renderCases() {
  const cases = filteredCases();
  const list = document.getElementById("case-list");
  const empty = document.getElementById("empty-state");
  const count = document.getElementById("case-count");

  count.textContent = cases.length
    ? `${cases.length} oral argument${cases.length === 1 ? "" : "s"}`
    : "";
  list.innerHTML = "";
  empty.hidden = cases.length !== 0;

  cases.forEach((c) => {
    const li = document.createElement("li");
    const tags = (c.categories || [])
      .filter((cat) => cat !== "uncategorized")
      .map((cat) => `<span class="tag">${CATEGORY_LABELS[cat] || cat}</span>`)
      .join("");
    li.innerHTML = `
      <button data-id="${c.id}">
        <span class="case-name">${escapeHtml(c.case_name)}</span>
        <span class="case-duration">${fmtDuration(c.duration_seconds)}</span>
        <span class="case-meta">
          <span>${c.court_id ? c.court_id.toUpperCase() : ""}</span>
          <span>${fmtDate(c.date_argued)}</span>
          ${c.docket_number ? `<span>No. ${escapeHtml(c.docket_number)}</span>` : ""}
        </span>
        <span class="case-tags">${tags}</span>
      </button>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => openDetail(btn.dataset.id));
  });
}

function openDetail(id) {
  const c = ALL_CASES.find((c) => String(c.id) === String(id));
  if (!c) return;
  const overlay = document.getElementById("detail-overlay");
  const content = document.getElementById("detail-content");

  const tags = (c.categories || [])
    .filter((cat) => cat !== "uncategorized")
    .map((cat) => `<span class="tag">${CATEGORY_LABELS[cat] || cat}</span>`)
    .join("");

  const audioSection = c.audio_url
    ? `<div class="audio-wrap"><audio controls preload="none" src="${c.audio_url}"></audio></div>`
    : `<p class="no-audio-note">No audio file on record for this entry${c.source === "demo" ? " (this is a demo placeholder case)" : ""}.</p>`;

  const transcriptSection = c.transcript_text
    ? `<h3 class="transcript-heading">Transcript</h3><div class="transcript-body">${escapeHtml(c.transcript_text)}</div>`
    : `<p class="transcript-empty">No transcript available for this argument yet.</p>`;

  content.innerHTML = `
    <h2 class="detail-title">${escapeHtml(c.case_name)}</h2>
    <div class="detail-meta">
      <span>${escapeHtml(c.court_name || c.court_id || "")}</span>
      <span>${fmtDate(c.date_argued)}</span>
      ${c.docket_number ? `<span>Docket No. ${escapeHtml(c.docket_number)}</span>` : ""}
    </div>
    <div class="detail-tags">${tags}</div>
    ${audioSection}
    ${transcriptSection}
  `;
  overlay.hidden = false;
}

document.getElementById("detail-close").addEventListener("click", () => {
  document.getElementById("detail-overlay").hidden = true;
});
document.getElementById("detail-overlay").addEventListener("click", (e) => {
  if (e.target.id === "detail-overlay") e.currentTarget.hidden = true;
});

let searchTimeout;
document.getElementById("search-input").addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.search = e.target.value.trim();
    renderCases();
  }, 200);
});

loadData();
