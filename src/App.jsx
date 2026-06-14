import { useState, useEffect, useRef } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyktd16KfQj_octrct618VU5aW45T9mNikgMV2wibfWbl4FAvZgh5TO-dgUG_fgjg7o/exec";

// ─── Week helpers ─────────────────────────────────────────────────────────────
function getMonday(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekKey(dateStr) {
  const mon = getMonday(dateStr);
  return mon.toISOString().split("T")[0];
}

function getWeekLabel(weekKey) {
  const d = new Date(weekKey + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getCurrentWeekKey() {
  return getWeekKey(new Date().toISOString().split("T")[0]);
}

function getLast20Weeks() {
  const weeks = [];
  const now = new Date();
  for (let i = 19; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getWeekKey(d.toISOString().split("T")[0]));
  }
  return weeks;
}


const today = new Date().toISOString().split("T")[0];

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp = {
  width: "100%", background: "#161616", border: "1px solid #2a2a2a",
  borderRadius: 4, color: "#e8e2d9", padding: "10px 12px",
  fontSize: 14, fontFamily: "Georgia, serif", boxSizing: "border-box"
};
const lbl = {
  fontSize: 10, letterSpacing: 2, color: "#888",
  textTransform: "uppercase", display: "block", marginBottom: 6
};
const secTitle = {
  fontSize: 11, letterSpacing: 3, color: "#666",
  textTransform: "uppercase", marginBottom: 14
};
const btn = (active, color = "#4a7c59") => ({
  width: "100%", background: active ? color : "#1a1a1a",
  color: "#e8e2d9", border: "none", borderRadius: 4,
  padding: 14, fontSize: 15, cursor: active ? "pointer" : "default",
  fontFamily: "Georgia, serif", fontWeight: 700
});

// ─── Options ──────────────────────────────────────────────────────────────────
const EVENT_CATEGORIES = ["Sports", "Culture", "Arts", "Social", "Professional", "Spiritual", "Other"];
const AGE_BRACKETS = ["Under 25", "25–34", "35–44", "45–54", "55+", "Unknown"];
const GENDERS = ["Man", "Woman", "Non-binary", "Other", "Unknown"];
const ORIENTATIONS = ["Straight", "Gay/Lesbian", "Bisexual", "Queer", "Other", "Unknown"];
const REL_STATUSES = ["Single", "In a relationship", "Married", "It's complicated", "Unknown"];
const NATIONALITIES = [
  "London Irish", "Irish", "British", "American", "Australian", "Canadian", "French", "German",
  "Italian", "Spanish", "Portuguese", "Dutch", "Belgian", "Swedish", "Norwegian", "Danish",
  "Finnish", "Polish", "Czech", "Hungarian", "Romanian", "Greek", "Turkish", "Russian",
  "Ukrainian", "Israeli", "Lebanese", "Iranian", "Indian", "Pakistani", "Bangladeshi",
  "Sri Lankan", "Nepali", "Chinese", "Japanese", "Korean", "Filipino", "Vietnamese",
  "Thai", "Indonesian", "Malaysian", "Singaporean", "Nigerian", "Ghanaian", "Kenyan",
  "South African", "Ethiopian", "Somali", "Moroccan", "Egyptian", "Algerian",
  "Brazilian", "Colombian", "Mexican", "Argentinian", "Chilean", "Venezuelan",
  "New Zealander", "Other", "Unknown"
].sort((a, b) => {
  const priority = ["London Irish", "Irish", "British"];
  const ai = priority.indexOf(a), bi = priority.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  if (a === "Other" || a === "Unknown") return 1;
  if (b === "Other" || b === "Unknown") return -1;
  return a.localeCompare(b);
});

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(action, data) {
  try {
    if (action === "getAll") {
      const r = await fetch(`${SCRIPT_URL}?action=getAll`);
      return await r.json();
    } else {
      await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action, data }) });
      return { ok: true };
    }
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ─── Mini chart components ────────────────────────────────────────────────────
function BarChart({ data, color = "#4a7c59" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80, marginTop: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 10, color: "#888" }}>{d.value || ""}</div>
          <div style={{ width: "100%", background: color, borderRadius: "2px 2px 0 0", height: `${(d.value / max) * 56}px`, minHeight: d.value ? 4 : 0, transition: "height 0.3s" }} />
          <div style={{ fontSize: 9, color: "#555", textAlign: "center", lineHeight: 1.2 }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points, color = "#c8b89a" }) {
  if (!points || points.length < 2) return <div style={{ fontSize: 12, color: "#444", padding: "20px 0" }}>Not enough data yet</div>;
  const max = Math.max(...points.map(p => p.value), 1);
  const w = 300, h = 80, pad = 20;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map(p => h - pad - (p.value / max) * (h - pad * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 80 }}>
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r="3" fill={color} />
            <text x={x} y={h - 2} textAnchor="middle" fontSize="7" fill="#555">{points[i].label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function MatrixChart({ connections }) {
  const genders = ["Man", "Woman", "Non-binary", "Other"];
  const orients = ["Straight", "Gay/Lesbian", "Bisexual", "Queer", "Other"];
  const counts = {};
  connections.forEach(c => {
    const g = genders.includes(c.gender) ? c.gender : null;
    const o = orients.includes(c.orientation) ? c.orientation : null;
    if (!g || !o) return;
    const k = `${g}|${o}`;
    counts[k] = (counts[k] || 0) + 1;
  });
  const max = Math.max(...Object.values(counts), 1);
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 10 }}>
        <thead>
          <tr>
            <td style={{ color: "#555", padding: "2px 4px" }}></td>
            {orients.map(o => <th key={o} style={{ color: "#888", fontWeight: 400, padding: "2px 4px", textAlign: "center", fontSize: 9 }}>{o.split("/")[0]}</th>)}
          </tr>
        </thead>
        <tbody>
          {genders.map(g => (
            <tr key={g}>
              <td style={{ color: "#888", padding: "2px 4px", whiteSpace: "nowrap", fontSize: 9 }}>{g}</td>
              {orients.map(o => {
                const v = counts[`${g}|${o}`] || 0;
                const intensity = v / max;
                return (
                  <td key={o} style={{ textAlign: "center", padding: "4px", background: v ? `rgba(74,124,89,${0.2 + intensity * 0.8})` : "#1a1a1a", borderRadius: 3, color: v ? "#e8e2d9" : "#333", fontWeight: 700, fontSize: 12 }}>
                    {v || "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Map component ────────────────────────────────────────────────────────────
function MapView({ dimEvents, fctOccurrences, connections }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!window.L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([51.505, -0.12], 12);
    mapInstanceRef.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap © CARTO", maxZoom: 19
    }).addTo(map);

    // Geocode events with addresses and add heatmap-style circles
    dimEvents.forEach(ev => {
      if (!ev.address) return;
      const occCount = fctOccurrences.filter(o => o.eventId === ev.id).length;
      const connCount = connections.filter(c => {
        const occ = fctOccurrences.find(o => o.id === c.occurrenceId);
        return occ && occ.eventId === ev.id;
      }).length;
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ev.address)}`)
        .then(r => r.json())
        .then(results => {
          if (!results[0]) return;
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          const radius = 50 + connCount * 20;
          L.circle([lat, lng], {
            radius,
            color: "#4a7c59",
            fillColor: "#4a7c59",
            fillOpacity: 0.4,
            weight: 1
          }).addTo(map).bindPopup(`<b>${ev.name}</b><br>${occCount} session${occCount !== 1 ? "s" : ""}<br>${connCount} connection${connCount !== 1 ? "s" : ""}`);
          L.circleMarker([lat, lng], { radius: 4, color: "#c8b89a", fillColor: "#c8b89a", fillOpacity: 1, weight: 1 }).addTo(map);
        }).catch(() => {});
    });

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [mapLoaded, dimEvents, fctOccurrences, connections]);

  return (
    <div>
      <div style={secTitle}>Connection heatmap</div>
      {dimEvents.filter(e => e.address).length === 0 && (
        <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>Add addresses to your events to see them on the map.</div>
      )}
      <div ref={mapRef} style={{ width: "100%", height: 340, borderRadius: 6, background: "#111", overflow: "hidden" }} />
      <div style={{ fontSize: 10, color: "#444", marginTop: 6 }}>Circle size = connections made at that venue</div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState({ dimEvents: [], fctOccurrences: [], connections: [] });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [view, setView] = useState("dashboard");

  const blankEvent = { name: "", category: "Social", subcategory: "", address: "", recurring: true, notes: "" };
  const blankOcc = { eventId: "", date: today, peopleTalkedTo: "" };
  const blankConn = { name: "", ageBracket: "Unknown", gender: "Unknown", orientation: "Unknown", relationshipStatus: "Unknown", nationality: "Unknown", worksInTech: "Unknown", notes: "", occurrenceId: "" };

  const [eventForm, setEventForm] = useState(blankEvent);
  const [occForm, setOccForm] = useState(blankOcc);
  const [connForm, setConnForm] = useState(blankConn);
  const [expandedConn, setExpandedConn] = useState(null);

  useEffect(() => {
    api("getAll").then(res => {
      if (res?.dimEvents) setData(res);
      setLoading(false);
    });
  }, []);

  async function sync(action, entry, optimisticUpdate) {
    optimisticUpdate();
    setSyncStatus("saving");
    const res = await api(action, entry);
    setSyncStatus(res?.ok ? "ok" : "error");
    setTimeout(() => setSyncStatus(null), 2500);
  }

  async function addDimEvent() {
    if (!eventForm.name) return;
    const entry = { id: Date.now().toString(), ...eventForm };
    await sync("addDimEvent", entry, () => setData(d => ({ ...d, dimEvents: [...d.dimEvents, entry] })));
    setEventForm(blankEvent);
  }

  async function addOccurrence() {
    if (!occForm.eventId || !occForm.date) return;
    const entry = { id: Date.now().toString(), ...occForm };
    await sync("addOccurrence", entry, () => setData(d => ({ ...d, fctOccurrences: [...d.fctOccurrences, entry] })));
    setOccForm(blankOcc);
  }

  async function addConnection() {
    if (!connForm.name || !connForm.occurrenceId) return;
    const entry = { id: Date.now().toString(), ...connForm };
    await sync("addConnection", entry, () => setData(d => ({ ...d, connections: [...d.connections, entry] })));
    setConnForm(blankConn);
  }

  async function deleteConnection(id) {
    setData(d => ({ ...d, connections: d.connections.filter(c => c.id !== id) }));
    await api("deleteConnection", { id });
  }
  async function deleteOccurrence(id) {
    setData(d => ({ ...d, fctOccurrences: d.fctOccurrences.filter(o => o.id !== id) }));
    await api("deleteOccurrence", { id });
  }
  async function deleteDimEvent(id) {
    setData(d => ({ ...d, dimEvents: d.dimEvents.filter(e => e.id !== id) }));
    await api("deleteDimEvent", { id });
  }

  // ── Derived ──
  const weeks = getLast20Weeks();
  const currentWeek = getCurrentWeekKey();
  const lastWeek = weeks[weeks.length - 2];

  const connByWeek = {};
  data.connections.forEach(c => {
    const occ = data.fctOccurrences.find(o => o.id === c.occurrenceId);
    if (!occ) return;
    const wk = getWeekKey(occ.date);
    if (!connByWeek[wk]) connByWeek[wk] = [];
    connByWeek[wk].push({ ...c, occ });
  });

  const streak = (() => {
    let s = 0;
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (weeks[i] === currentWeek) continue;
      if (connByWeek[weeks[i]]?.length > 0) s++;
      else break;
    }
    return s;
  })();

  const irishCount = data.connections.filter(c => c.nationality === "Irish" || c.nationality === "London Irish").length;

  const getEventName = (eventId) => data.dimEvents.find(e => e.id === eventId)?.name || "Unknown event";
  const getOccLabel = (occ) => `${getEventName(occ.eventId)} · ${occ.date}`;

  // Chart data
  const relStatusData = REL_STATUSES.map(s => ({
    label: s === "In a relationship" ? "In rel." : s === "It's complicated" ? "Complex" : s,
    value: data.connections.filter(c => c.relationshipStatus === s).length
  }));

  const weeklyPeopleData = weeks.slice(-10).map(wk => {
    const occsThisWeek = data.fctOccurrences.filter(o => getWeekKey(o.date) === wk);
    const total = occsThisWeek.reduce((sum, o) => sum + (parseInt(o.peopleTalkedTo) || 0), 0);
    return { label: getWeekLabel(wk).split(" ")[0], value: total };
  });

  const natCounts = {};
  data.connections.forEach(c => {
    if (c.nationality && c.nationality !== "Unknown") natCounts[c.nationality] = (natCounts[c.nationality] || 0) + 1;
  });
  const topNats = Object.entries(natCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const syncLabel = syncStatus === "saving" ? "Saving…" : syncStatus === "ok" ? "✓ Saved" : syncStatus === "error" ? "⚠ Error" : "";
  const syncColor = syncStatus === "saving" ? "#888" : syncStatus === "ok" ? "#4a7c59" : "#c0392b";

  const navItems = [
    { key: "dashboard", label: "Map", icon: "⬛" },
    { key: "events", label: "Events", icon: "◎" },
    { key: "log", label: "Log", icon: "＋" },
    { key: "people", label: "People", icon: "◉" },
    { key: "stats", label: "Stats", icon: "◈" },
  ];

  if (loading) return (
    <div style={{ fontFamily: "Georgia, serif", background: "#0f0f0f", minHeight: "100vh", color: "#555", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Loading from Sheet…
    </div>
  );

  return (
    <div style={{ fontFamily: "Georgia, serif", background: "#0f0f0f", minHeight: "100vh", color: "#e8e2d9", maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 10px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#888", textTransform: "uppercase", marginBottom: 2 }}>Weekly Practice</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>One New Person</div>
        </div>
        {syncLabel && <div style={{ fontSize: 10, color: syncColor }}>{syncLabel}</div>}
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", background: "#111" }}>
        {[
          { label: "People", val: data.connections.length },
          { label: "Streak", val: `${streak}w` },
          { label: "Irish", val: irishCount },
          { label: "Sessions", val: data.fctOccurrences.length },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: "12px 0", textAlign: "center", borderRight: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.label === "Irish" ? "#c8b89a" : "#c8b89a" }}>{s.val}</div>
            <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "16px 20px" }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <div style={secTitle}>20-Week Grid</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {weeks.map(wk => {
                const count = connByWeek[wk]?.length || 0;
                const isCurrent = wk === currentWeek;
                const isLast = wk === lastWeek;
                const met = count > 0;
                const bg = met ? "#4a7c59" : isLast ? "#7c1a1a" : isCurrent ? "#2a2a2a" : "#1c1c1c";
                return (
                  <div key={wk} style={{ background: bg, border: isCurrent ? "2px solid #c8b89a" : "2px solid transparent", borderRadius: 4, padding: "8px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: met ? "#a8d5b5" : isLast ? "#e88" : "#444" }}>{getWeekLabel(wk)}</div>
                    {count > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: "#e8e2d9", marginTop: 2 }}>{count}</div>}
                    {isCurrent && <div style={{ fontSize: 7, color: "#c8b89a", marginTop: 1, letterSpacing: 1 }}>NOW</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, fontSize: 10, color: "#555", flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#4a7c59", borderRadius: 2, marginRight: 4 }} />Met someone</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#7c1a1a", borderRadius: 2, marginRight: 4 }} />Last week (missed)</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2a2a2a", border: "2px solid #c8b89a", borderRadius: 2, marginRight: 4 }} />This week</span>
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={secTitle}>This week</div>
              {(connByWeek[currentWeek] || []).length === 0 ? (
                <div style={{ background: "#161616", border: "1px dashed #2a2a2a", borderRadius: 6, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#555" }}>No one logged yet this week</div>
                  <button onClick={() => setView("log")} style={{ marginTop: 10, background: "none", border: "1px solid #444", color: "#c8b89a", borderRadius: 4, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif" }}>Log someone →</button>
                </div>
              ) : (
                connByWeek[currentWeek].map(c => (
                  <div key={c.id} style={{ background: "#161616", borderLeft: "3px solid #4a7c59", borderRadius: 4, padding: "10px 14px", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{getEventName(c.occ.eventId)} · {c.occ.date}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 28 }}>
              <MapView dimEvents={data.dimEvents} fctOccurrences={data.fctOccurrences} connections={data.connections} />
            </div>
          </div>
        )}

        {/* EVENTS */}
        {view === "events" && (
          <div>
            <div style={secTitle}>Create event type</div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Event name</label>
              <input value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} placeholder="e.g. Life drawing at LFAS" style={inp} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Category</label>
                <select value={eventForm.category} onChange={e => setEventForm({ ...eventForm, category: e.target.value })} style={inp}>
                  {EVENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Subcategory</label>
                <input value={eventForm.subcategory} onChange={e => setEventForm({ ...eventForm, subcategory: e.target.value })} placeholder="e.g. Figure drawing" style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Address</label>
              <input value={eventForm.address} onChange={e => setEventForm({ ...eventForm, address: e.target.value })} placeholder="e.g. 11 Churchyard Row, London SE11" style={inp} />
            </div>
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" id="recurring" checked={eventForm.recurring} onChange={e => setEventForm({ ...eventForm, recurring: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#c8b89a" }} />
              <label htmlFor="recurring" style={{ fontSize: 13, color: "#aaa" }}>Recurring event</label>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Notes</label>
              <input value={eventForm.notes} onChange={e => setEventForm({ ...eventForm, notes: e.target.value })} placeholder="Optional" style={inp} />
            </div>
            <button onClick={addDimEvent} disabled={!eventForm.name} style={btn(!!eventForm.name)}>Save event type</button>

            {data.dimEvents.length > 0 && (<>
              <div style={{ ...secTitle, marginTop: 28 }}>Log attendance</div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Event</label>
                <select value={occForm.eventId} onChange={e => setOccForm({ ...occForm, eventId: e.target.value })} style={inp}>
                  <option value="">Select event…</option>
                  {data.dimEvents.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Date</label>
                <input type="date" value={occForm.date} onChange={e => setOccForm({ ...occForm, date: e.target.value })} style={inp} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>People talked to (approx)</label>
                <input type="number" value={occForm.peopleTalkedTo} onChange={e => setOccForm({ ...occForm, peopleTalkedTo: e.target.value })} placeholder="e.g. 5" style={inp} />
              </div>
              <button onClick={addOccurrence} disabled={!occForm.eventId || !occForm.date} style={btn(!!(occForm.eventId && occForm.date), "#3a3a5c")}>Log attendance</button>
            </>)}

            {data.dimEvents.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={secTitle}>Your events</div>
                {data.dimEvents.map(e => (
                  <div key={e.id} style={{ background: "#161616", borderLeft: "3px solid #3a3a5c", borderRadius: 4, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{e.category}{e.subcategory ? ` · ${e.subcategory}` : ""}{e.recurring ? " · recurring" : ""}</div>
                      {e.address && <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{e.address}</div>}
                    </div>
                    <button onClick={() => deleteDimEvent(e.id)} style={{ background: "none", border: "none", color: "#444", fontSize: 18, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {data.fctOccurrences.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={secTitle}>Attendance log</div>
                {[...data.fctOccurrences].reverse().map(o => (
                  <div key={o.id} style={{ background: "#161616", borderLeft: "3px solid #2a2a3c", borderRadius: 4, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{getEventName(o.eventId)}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{o.date}{o.peopleTalkedTo ? ` · ~${o.peopleTalkedTo} talked to` : ""}</div>
                    </div>
                    <button onClick={() => deleteOccurrence(o.id)} style={{ background: "none", border: "none", color: "#444", fontSize: 18, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LOG */}
        {view === "log" && (
          <div>
            <div style={secTitle}>Log a connection</div>
            {data.fctOccurrences.length === 0 && (
              <div style={{ background: "#161616", border: "1px dashed #2a2a2a", borderRadius: 6, padding: 16, marginBottom: 16, fontSize: 13, color: "#666" }}>
                Log an event attendance first under the Events tab.
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Name</label>
              <input value={connForm.name} onChange={e => setConnForm({ ...connForm, name: e.target.value })} placeholder="e.g. Siobhán" style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Event session</label>
              <select value={connForm.occurrenceId} onChange={e => setConnForm({ ...connForm, occurrenceId: e.target.value })} style={inp}>
                <option value="">Select session…</option>
                {[...data.fctOccurrences].reverse().map(o => <option key={o.id} value={o.id}>{getOccLabel(o)}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Age bracket</label>
                <select value={connForm.ageBracket} onChange={e => setConnForm({ ...connForm, ageBracket: e.target.value })} style={inp}>
                  {AGE_BRACKETS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Gender</label>
                <select value={connForm.gender} onChange={e => setConnForm({ ...connForm, gender: e.target.value })} style={inp}>
                  {GENDERS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Orientation</label>
                <select value={connForm.orientation} onChange={e => setConnForm({ ...connForm, orientation: e.target.value })} style={inp}>
                  {ORIENTATIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Relationship</label>
                <select value={connForm.relationshipStatus} onChange={e => setConnForm({ ...connForm, relationshipStatus: e.target.value })} style={inp}>
                  {REL_STATUSES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Nationality</label>
              <select value={connForm.nationality} onChange={e => setConnForm({ ...connForm, nationality: e.target.value })} style={inp}>
                {NATIONALITIES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Works in tech</label>
              <select value={connForm.worksInTech} onChange={e => setConnForm({ ...connForm, worksInTech: e.target.value })} style={inp}>
                {["Yes", "No", "Unknown"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Notes</label>
              <textarea value={connForm.notes} onChange={e => setConnForm({ ...connForm, notes: e.target.value })} placeholder="Anything worth remembering…" rows={3} style={{ ...inp, resize: "vertical" }} />
            </div>
            <button onClick={addConnection} disabled={!connForm.name || !connForm.occurrenceId} style={btn(!!(connForm.name && connForm.occurrenceId))}>
              {syncStatus === "saving" ? "Saving…" : syncStatus === "ok" ? "✓ Saved" : "Save connection"}
            </button>
          </div>
        )}

        {/* PEOPLE */}
        {view === "people" && (
          <div>
            <div style={secTitle}>Everyone you've met ({data.connections.length})</div>
            {data.connections.length === 0 && <div style={{ color: "#555", fontSize: 14, textAlign: "center", marginTop: 40 }}>No connections logged yet</div>}
            {[...data.connections].reverse().map(c => {
              const occ = data.fctOccurrences.find(o => o.id === c.occurrenceId);
              return (
                <div key={c.id} style={{ background: "#161616", borderLeft: "3px solid #4a7c59", borderRadius: 4, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div onClick={() => setExpandedConn(expandedConn === c.id ? null : c.id)} style={{ cursor: "pointer", flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                        {occ ? `${getEventName(occ.eventId)} · ${occ.date}` : "Unknown session"}
                      </div>
                    </div>
                    <button onClick={() => deleteConnection(c.id)} style={{ background: "none", border: "none", color: "#333", fontSize: 18, cursor: "pointer", padding: "0 0 0 8px" }}>×</button>
                  </div>
                  {expandedConn === c.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #222" }}>
                      {[
                        ["Age", c.ageBracket], ["Gender", c.gender], ["Orientation", c.orientation],
                        ["Relationship", c.relationshipStatus], ["Nationality", c.nationality], ["Works in tech", c.worksInTech],
                      ].filter(([, v]) => v && v !== "Unknown").map(([k, v]) => (
                        <div key={k} style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>
                          <span style={{ color: "#555", marginRight: 6 }}>{k}:</span>{v}
                        </div>
                      ))}
                      {c.notes && <div style={{ fontSize: 13, color: "#aaa", marginTop: 8, lineHeight: 1.5 }}>{c.notes}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* STATS */}
        {view === "stats" && (
          <div>
            {/* Irish counter */}
            <div style={{ background: "#161616", borderLeft: "3px solid #c8b89a", borderRadius: 4, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>Irish connections</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#c8b89a" }}>{irishCount}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                {data.connections.filter(c => c.nationality === "London Irish").length} London Irish · {data.connections.filter(c => c.nationality === "Irish").length} Irish
              </div>
            </div>

            {/* Nationalities */}
            <div style={{ background: "#161616", borderRadius: 4, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ ...secTitle, marginBottom: 8 }}>Nationalities met ({Object.keys(natCounts).length})</div>
              {topNats.length === 0
                ? <div style={{ fontSize: 12, color: "#444" }}>No data yet</div>
                : topNats.map(([nat, count]) => (
                  <div key={nat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 13, color: "#aaa" }}>{nat}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${(count / (topNats[0][1])) * 100}%`, height: "100%", background: "#4a7c59", borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 12, color: "#666", width: 16, textAlign: "right" }}>{count}</div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Relationship status bar chart */}
            <div style={{ background: "#161616", borderRadius: 4, padding: "14px 16px", marginBottom: 16 }}>
              <div style={secTitle}>Relationship status</div>
              <BarChart data={relStatusData} color="#3a3a5c" />
            </div>

            {/* Gender × Orientation matrix */}
            <div style={{ background: "#161616", borderRadius: 4, padding: "14px 16px", marginBottom: 16 }}>
              <div style={secTitle}>Gender × Orientation</div>
              <MatrixChart connections={data.connections} />
            </div>

            {/* Weekly people talked to */}
            <div style={{ background: "#161616", borderRadius: 4, padding: "14px 16px", marginBottom: 16 }}>
              <div style={secTitle}>Weekly people talked to (last 10 weeks)</div>
              <LineChart points={weeklyPeopleData} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0f0f0f", borderTop: "1px solid #1a1a1a", display: "flex" }}>
        {navItems.map(n => (
          <button key={n.key} onClick={() => setView(n.key)}
            style={{ flex: 1, background: "none", border: "none", color: view === n.key ? "#c8b89a" : "#555", padding: "12px 0 10px", cursor: "pointer", fontFamily: "Georgia, serif" }}>
            <div style={{ fontSize: 16 }}>{n.icon}</div>
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>{n.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}