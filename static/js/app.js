/* Avi Snow Outreach App — frontend */

// ── State ─────────────────────────────────────────────────────────────────────
let curatorData = [];
let trackerData = [];
let charts = {};

// ── Tab navigation ────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "analytics") loadAnalytics();
    if (btn.dataset.tab === "tracker") loadTracker();
    if (btn.dataset.tab === "blogs") loadBlogs();
  });
});

// ── Curator Finder ────────────────────────────────────────────────────────────
document.getElementById("search-btn").addEventListener("click", searchCurators);
document.getElementById("artist-input").addEventListener("keydown", e => {
  if (e.key === "Enter") searchCurators();
});

async function searchCurators() {
  const artist = document.getElementById("artist-input").value.trim() || "Avi Snow";
  const statusEl = document.getElementById("curator-status");
  const resultsEl = document.getElementById("curator-results");
  const cardEl = document.getElementById("artist-card");
  const searchBtn = document.getElementById("search-btn");

  searchBtn.disabled = true;
  searchBtn.textContent = "Searching…";
  statusEl.textContent = "Connecting to Spotify…";
  resultsEl.classList.add("hidden");
  cardEl.classList.add("hidden");

  try {
    const res = await fetch(`/api/curators?artist=${encodeURIComponent(artist)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");

    curatorData = data.curators;

    // Artist card
    const a = data.artist;
    cardEl.innerHTML = `
      ${a.image ? `<img src="${a.image}" alt="${esc(a.name)}" />` : ""}
      <div class="info">
        <h3><a href="${a.url}" target="_blank" class="link">${esc(a.name)}</a></h3>
        <p>${(a.followers || 0).toLocaleString()} followers · ${a.genres.slice(0, 3).join(", ") || "no genres listed"}</p>
        <p style="margin-top:6px">Related: ${data.related.join(", ")}</p>
      </div>`;
    cardEl.classList.remove("hidden");

    // Table
    const tbody = document.querySelector("#curator-table tbody");
    tbody.innerHTML = curatorData.map((c, i) => `
      <tr>
        <td><a href="${c.playlist_url}" target="_blank" class="link">${esc(c.playlist_name)}</a></td>
        <td><a href="${c.owner_url}" target="_blank" class="link">${esc(c.owner_display)}</a></td>
        <td class="right">${(c.followers || 0).toLocaleString()}</td>
        <td><span style="color:var(--muted)">${esc(c.found_via)}</span></td>
        <td><button class="btn-icon" onclick="saveCurator(${i})">Save</button></td>
      </tr>`).join("");

    document.getElementById("curator-count").textContent = `${curatorData.length} curators found`;
    statusEl.textContent = "";
    resultsEl.classList.remove("hidden");
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    if (err.message.includes("CLIENT_ID") || err.message.includes("CLIENT_SECRET")) {
      statusEl.innerHTML += `<br/><small>Set <code>SPOTIFY_CLIENT_ID</code> and <code>SPOTIFY_CLIENT_SECRET</code> environment variables before starting the app.</small>`;
    }
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Search";
  }
}

async function saveCurator(index) {
  const c = curatorData[index];
  await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "playlist_curator",
      name: c.playlist_name,
      contact: c.playlist_url,
      platform: "spotify",
      status: "identified",
      notes: `Owner: ${c.owner_display} | Followers: ${c.followers} | Found via: ${c.found_via}`,
    }),
  });
  showToast("Saved to tracker");
}

document.getElementById("save-all-btn").addEventListener("click", async () => {
  const entries = curatorData.map(c => ({
    type: "playlist_curator",
    name: c.playlist_name,
    contact: c.playlist_url,
    platform: "spotify",
    status: "identified",
    notes: `Owner: ${c.owner_display} | Followers: ${c.followers} | Found via: ${c.found_via}`,
  }));
  const res = await fetch("/api/log/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });
  const d = await res.json();
  showToast(`Saved ${d.added} new entries to tracker`);
});

// ── Outreach Tracker ──────────────────────────────────────────────────────────
async function loadTracker() {
  const res = await fetch("/api/log");
  trackerData = await res.json();
  renderTracker();
}

function renderTracker() {
  const statusFilter = document.getElementById("filter-status").value;
  const typeFilter = document.getElementById("filter-type").value;
  const search = document.getElementById("filter-search").value.toLowerCase();

  let rows = trackerData.filter(e =>
    (!statusFilter || e.status === statusFilter) &&
    (!typeFilter || e.type === typeFilter) &&
    (!search || e.name.toLowerCase().includes(search) || (e.notes || "").toLowerCase().includes(search))
  );

  const tbody = document.querySelector("#tracker-table tbody");
  const emptyMsg = document.getElementById("tracker-empty");

  if (rows.length === 0) {
    tbody.innerHTML = "";
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

  const statusOptions = ["identified","contacted","added","declined","no_response"];
  tbody.innerHTML = rows.map(e => `
    <tr>
      <td style="color:var(--muted);white-space:nowrap">${e.date || ""}</td>
      <td><span class="badge badge-${e.type || 'unknown'}" style="font-size:10px">${esc(e.type || "")}</span></td>
      <td>
        ${e.contact ? `<a href="${esc(e.contact)}" target="_blank" class="link">${esc(e.name)}</a>` : esc(e.name)}
      </td>
      <td style="color:var(--muted)">${esc(e.platform || "")}</td>
      <td>
        <select class="status-select" data-id="${e.id}" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 8px;font-size:12px;outline:none">
          ${statusOptions.map(s => `<option value="${s}" ${e.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td style="color:var(--muted);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.notes || "")}">${esc(e.notes || "")}</td>
      <td>
        <button class="btn-icon" onclick="editEntry('${e.id}')">Edit</button>
        <button class="btn-icon danger" onclick="deleteEntry('${e.id}')">Del</button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll(".status-select").forEach(sel => {
    sel.addEventListener("change", async () => {
      await fetch(`/api/log/${sel.dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: sel.value }),
      });
      await loadTracker();
    });
  });
}

["filter-status","filter-type","filter-search"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderTracker);
});

async function deleteEntry(id) {
  if (!confirm("Delete this entry?")) return;
  await fetch(`/api/log/${id}`, { method: "DELETE" });
  await loadTracker();
}

function editEntry(id) {
  const e = trackerData.find(x => x.id === id);
  if (!e) return;
  openModal(e);
}

document.getElementById("add-entry-btn").addEventListener("click", () => openModal(null));

// ── Blogs & Platforms ─────────────────────────────────────────────────────────
async function loadBlogs() {
  const res = await fetch("/api/blogs");
  const blogs = await res.json();
  const grid = document.getElementById("blog-grid");
  const typeColors = { platform: "#1db954", blog: "#5ba3d9", community: "#c8a84b" };

  grid.innerHTML = blogs.map(b => `
    <div class="blog-card">
      <span class="type-chip" style="color:${typeColors[b.type] || "#888"}">${b.type}</span>
      <h4>${esc(b.name)}</h4>
      <p class="genres">${b.genres.join(", ")}</p>
      <a href="${esc(b.url)}" target="_blank" class="visit-btn">Visit →</a>
      <button class="save-blog-btn" onclick="saveBlog(this, '${esc(b.name)}','${esc(b.url)}','${b.type}')">Save to Tracker</button>
    </div>`).join("");
}

async function saveBlog(btn, name, url, type) {
  await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, name, contact: url, platform: "web", status: "identified" }),
  });
  btn.textContent = "Saved ✓";
  btn.classList.add("saved");
  showToast(`${name} saved to tracker`);
}

// ── Analytics ─────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  const res = await fetch("/api/stats");
  const stats = await res.json();

  // Stat cards
  const statusLabels = { identified: "Identified", contacted: "Contacted", added: "Added ✓", declined: "Declined", no_response: "No Response" };
  const cards = document.getElementById("stats-cards");
  cards.innerHTML = `<div class="stat-card"><div class="num">${stats.total}</div><div class="label">Total</div></div>` +
    Object.entries(stats.by_status).map(([s, n]) =>
      `<div class="stat-card"><div class="num">${n}</div><div class="label">${statusLabels[s] || s}</div></div>`
    ).join("");

  const green = "#1db954";
  const palette = ["#1db954","#5ba3d9","#c8a84b","#e07070","#a78bfa","#f59e0b","#34d399"];

  // Status doughnut
  renderChart("chart-status", "doughnut", Object.keys(stats.by_status), Object.values(stats.by_status), palette);
  // Type bar
  renderChart("chart-type", "bar", Object.keys(stats.by_type), Object.values(stats.by_type), palette);
  // Timeline line
  const months = Object.keys(stats.by_month);
  const counts = Object.values(stats.by_month);
  renderChart("chart-timeline", "line", months, counts, [green], { fill: true, tension: 0.4 });
}

function renderChart(id, type, labels, data, colors, extra = {}) {
  const canvas = document.getElementById(id);
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  charts[id] = new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: type === "line" ? "rgba(29,185,84,.15)" : colors,
        borderColor: type === "line" ? colors[0] : colors,
        borderWidth: type === "line" ? 2 : 1,
        ...extra,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#888", font: { size: 12 } } },
      },
      scales: type !== "doughnut" ? {
        x: { ticks: { color: "#888" }, grid: { color: "#2a2a2a" } },
        y: { ticks: { color: "#888" }, grid: { color: "#2a2a2a" }, beginAtZero: true },
      } : undefined,
    },
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(entry) {
  document.getElementById("modal-title").textContent = entry ? "Edit Entry" : "Add Entry";
  document.getElementById("form-id").value = entry?.id || "";
  document.getElementById("form-type").value = entry?.type || "playlist_curator";
  document.getElementById("form-name").value = entry?.name || "";
  document.getElementById("form-contact").value = entry?.contact || "";
  document.getElementById("form-platform").value = entry?.platform || "";
  document.getElementById("form-status").value = entry?.status || "identified";
  document.getElementById("form-notes").value = entry?.notes || "";
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

document.getElementById("modal-close-btn").addEventListener("click", closeModal);
document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

document.getElementById("entry-form").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("form-id").value;
  const payload = {
    type: document.getElementById("form-type").value,
    name: document.getElementById("form-name").value,
    contact: document.getElementById("form-contact").value,
    platform: document.getElementById("form-platform").value,
    status: document.getElementById("form-status").value,
    notes: document.getElementById("form-notes").value,
  };
  if (id) {
    await fetch(`/api/log/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } else {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
  closeModal();
  await loadTracker();
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed", bottom: "24px", right: "24px", background: "#1db954",
    color: "#000", padding: "10px 18px", borderRadius: "8px", fontWeight: "600",
    fontSize: "13px", zIndex: "999", boxShadow: "0 4px 12px rgba(0,0,0,.4)",
    transition: "opacity .3s",
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadTracker();
loadBlogs();
