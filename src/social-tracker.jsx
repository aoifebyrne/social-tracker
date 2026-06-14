import { useState, useEffect, useCallback } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyktd16KfQj_octrct618VU5aW45T9mNikgMV2wibfWbl4FAvZgh5TO-dgUG_fgjg7o/exec";

// ─── Week helpers ─────────────────────────────────────────────────────────────
function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
function getWeekLabel(weekKey) {
  const [year, wStr] = weekKey.split("-W");
  const week = parseInt(wStr);
  const jan1 = new Date(parseInt(year), 0, 1);
  const days = (week - 1) * 7 - jan1.getDay() + 1;
  const d = new Date(jan1);
  d.setDate(jan1.getDate() + days);
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

// ─── Apps Script ──────────────────────────────────────────────────────────────
export const APPS_SCRIPT = `
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  function sheetRows(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getDataRange().getValues().slice(1).filter(r => r[0]);
  }

  if (action === "getAll") {
    const dimEvents = sheetRows("dim_events").map(r => ({
      id: r[0], name: r[1], category: r[2], subcategory: r[3],
      address: r[4], recurring: r[5], notes: r[6]
    }));
    const fctOccurrences = sheetRows("fct_event_occurrences").map(r => ({
      id: r[0], eventId: r[1], date: r[2], peopleTalkedTo: r[3]
    }));
    const connections = sheetRows("dim_connections").map(r => ({
      id: r[0], name: r[1], ageBracket: r[2], gender: r[3],
      orientation: r[4], relationshipStatus: r[5], worksInTech: r[6],
      notes: r[7], occurrenceId: r[8]
    }));
    return ContentService
      .createTextOutput(JSON.stringify({ dimEvents, fctOccurrences, connections }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureHeaders(sh, headers) {
  if (sh.getLastRow() === 0) sh.appendRow(headers);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { action, data } = JSON.parse(e.postData.contents);

  if (action === "addDimEvent") {
    const sh = ss.getSheetByName("dim_events") || ss.insertSheet("dim_events");
    ensureHeaders(sh, ["ID","Name","Category","Subcategory","Address","Recurring","Notes"]);
    sh.appendRow([data.id, data.name, data.category, data.subcategory, data.address, data.recurring, data.notes]);
  }
  if (action === "addOccurrence") {
    const sh = ss.getSheetByName("fct_event_occurrences") || ss.insertSheet("fct_event_occurrences");
    ensureHeaders(sh, ["ID","EventID","Date","PeopleTalkedTo"]);
    sh.appendRow([data.id, data.eventId, data.date, data.peopleTalkedTo]);
  }
  if (action === "addConnection") {
    const sh = ss.getSheetByName("dim_connections") || ss.insertSheet("dim_connections");
    ensureHeaders(sh, ["ID","Name","AgeBracket","Gender","Orientation","RelationshipStatus","WorksInTech","Notes","OccurrenceID"]);
    sh.appendRow([data.id, data.name, data.ageBracket, data.gender, data.orientation,
                  data.relationshipStatus, data.worksInTech, data.notes, data.occurrenceId]);
  }
  if (action === "deleteDimEvent") {
    const sh = ss.getSheetByName("dim_events");
    if (sh) deleteRowById(sh, data.id);
  }
  if (action === "deleteOccurrence") {
    const sh = ss.getSheetByName("fct_event_occurrences");
    if (sh) deleteRowById(sh, data.id);
  }
  if (action === "deleteConnection") {
    const sh = ss.getSheetByName("dim_connections");
    if (sh) deleteRowById(sh, data.id);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function deleteRowById(sh, id) {
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(id)) { sh.deleteRow(i + 1); break; }
  }
}
`.trim();

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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState({ dimEvents: [], fctOccurrences: [], connections: [] });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [view, setView] = useState("dashboard");

  // Forms
  const blankEvent = { name: "", category: "Social", subcategory: "", address: "", recurring: true, notes: "" };
  const blankOcc = { eventId: "", date: today, peopleTalkedTo: "" };
  const blankConn = { name: "", ageBracket: "Unknown", gender: "Unknown", orientation: "Unknown", relationshipStatus: "Unknown", worksInTech: "Unknown", notes: "", occurrenceId: "" };

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

  // ── Add dim event ──
  async function addDimEvent() {
    if (!eventForm.name) return;
    const entry = { id: Date.now().toString(), ...eventForm };
    await sync("addDimEvent", entry, () =>
      setData(d => ({ ...d, dimEvents: [...d.dimEvents, entry] }))
    );
    setEventForm(blankEvent);
  }

  // ── Add occurrence ──
  async function addOccurrence() {
    if (!occForm.eventId || !occForm.date) return;
    const entry = { id: Date.now().toString(), ...occForm };
    await sync("addOccurrence", entry, () =>
      setData(d => ({ ...d, fctOccurrences: [...d.fctOccurrences, entry] }))
    );
    setOccForm(blankOcc);
  }

  // ── Add connection ──
  async function addConnection() {
    if (!connForm.name || !connForm.occurrenceId) return;
    const entry = { id: Date.now().toString(), ...connForm };
    await sync("addConnection", entry, () =>
      setData(d => ({ ...d, connections: [...d.connections, entry] }))
    );
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

  const navItems = [
    { key: "dashboard", label: "Map", icon: "⬛" },
    { key: "events", label: "Events", icon: "◎" },
    { key: "log", label: "Log", icon: "＋" },
    { key: "people", label: "People", icon: "◉" },
  ];

  const syncLabel = syncStatus === "saving" ? "Saving…" : syncStatus === "ok" ? "✓ Saved" : syncStatus === "error" ? "⚠ Error" : "";
  const syncColor = syncStatus === "saving" ? "#888" : syncStatus === "ok" ? "#4a7c59" : "#c0392b";

  const getEventName = (eventId) => data.dimEvents.find(e => e.id === eventId)?.name || "Unknown event";
  const getOccLabel = (occ) => `${getEventName(occ.eventId)} · ${occ.date}`;

  if (loading) {
    return (
      <div style={{ fontFamily: "Georgia, serif", background: "#0f0f0f", minHeight: "100vh", color: "#666", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading from Sheet…
      </div>
    );
  }

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

      {/* Stats */}
      <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", background: "#111" }}>
        {[
          { label: "People", val: data.connections.length },
          { label: "Streak", val: `${streak}w` },
          { label: "Events", val: data.dimEvents.length },
          { label: "Sessions", val: data.fctOccurrences.length },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: "12px 0", textAlign: "center", borderRight: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#c8b89a" }}>{s.val}</div>
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
                const met = count > 0;
                return (
                  <div key={wk} style={{
                    background: met ? "#4a7c59" : isCurrent ? "#2a2a2a" : "#1c1c1c",
                    border: isCurrent ? "2px solid #c8b89a" : "2px solid transparent",
                    borderRadius: 4, padding: "8px 4px", textAlign: "center"
                  }}>
                    <div style={{ fontSize: 9, color: met ? "#a8d5b5" : "#444" }}>{getWeekLabel(wk)}</div>
                    {count > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: "#e8e2d9", marginTop: 2 }}>{count}</div>}
                    {isCurrent && <div style={{ fontSize: 7, color: "#c8b89a", marginTop: 1, letterSpacing: 1 }}>NOW</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 10, color: "#555", alignItems: "center" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#4a7c59", borderRadius: 2, marginRight: 4 }} />Met someone</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1c1c1c", border: "1px solid #333", borderRadius: 2, marginRight: 4 }} />Empty</span>
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
          </div>
        )}

        {/* EVENTS */}
        {view === "events" && (
          <div>
            {/* Create event type */}
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
            <button onClick={addDimEvent} disabled={!eventForm.name} style={btn(!!eventForm.name)}>
              Save event type
            </button>

            {/* Log an occurrence */}
            {data.dimEvents.length > 0 && (
              <>
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
                <button onClick={addOccurrence} disabled={!occForm.eventId || !occForm.date} style={btn(!!(occForm.eventId && occForm.date), "#3a3a5c")}>
                  Log attendance
                </button>
              </>
            )}

            {/* Event types list */}
            {data.dimEvents.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={secTitle}>Your events</div>
                {data.dimEvents.map(e => (
                  <div key={e.id} style={{ background: "#161616", borderLeft: "3px solid #3a3a5c", borderRadius: 4, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{e.category}{e.subcategory ? ` · ${e.subcategory}` : ""}{e.recurring ? " · recurring" : ""}</div>
                    </div>
                    <button onClick={() => deleteDimEvent(e.id)} style={{ background: "none", border: "none", color: "#444", fontSize: 18, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Occurrences list */}
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

        {/* LOG CONNECTION */}
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
                {[...data.fctOccurrences].reverse().map(o => (
                  <option key={o.id} value={o.id}>{getOccLabel(o)}</option>
                ))}
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
              <label style={lbl}>Works in tech</label>
              <select value={connForm.worksInTech} onChange={e => setConnForm({ ...connForm, worksInTech: e.target.value })} style={inp}>
                {["Yes", "No", "Unknown"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Notes</label>
              <textarea value={connForm.notes} onChange={e => setConnForm({ ...connForm, notes: e.target.value })} placeholder="Anything worth remembering about them…" rows={3}
                style={{ ...inp, resize: "vertical" }} />
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
            {data.connections.length === 0 && (
              <div style={{ color: "#555", fontSize: 14, textAlign: "center", marginTop: 40 }}>No connections logged yet</div>
            )}
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
                        ["Age", c.ageBracket],
                        ["Gender", c.gender],
                        ["Orientation", c.orientation],
                        ["Relationship", c.relationshipStatus],
                        ["Works in tech", c.worksInTech],
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
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0f0f0f", borderTop: "1px solid #1a1a1a", display: "flex" }}>
        {navItems.map(n => (
          <button key={n.key} onClick={() => setView(n.key)}
            style={{ flex: 1, background: "none", border: "none", color: view === n.key ? "#c8b89a" : "#555", padding: "12px 0 10px", cursor: "pointer", fontFamily: "Georgia, serif" }}>
            <div style={{ fontSize: 18 }}>{n.icon}</div>
            <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>{n.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}