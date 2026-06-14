import { useState, useEffect, useCallback } from "react";

// ─── Week helpers ────────────────────────────────────────────────────────────
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

// ─── Shared styles ────────────────────────────────────────────────────────────
const input = {
  width: "100%", background: "#161616", border: "1px solid #2a2a2a",
  borderRadius: 4, color: "#e8e2d9", padding: "10px 12px",
  fontSize: 14, fontFamily: "Georgia, serif", boxSizing: "border-box"
};
const label = {
  fontSize: 10, letterSpacing: 2, color: "#888",
  textTransform: "uppercase", display: "block", marginBottom: 6
};
const sectionTitle = {
  fontSize: 11, letterSpacing: 3, color: "#666",
  textTransform: "uppercase", marginBottom: 14
};

// ─── Apps Script code to show the user ───────────────────────────────────────
const APPS_SCRIPT = `
// Paste this into Tools > Script editor in your Google Sheet, then Deploy > Web App
// Execute as: Me | Who has access: Anyone

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  if (action === "getAll") {
    const conn = sheet.getSheetByName("Connections") || sheet.insertSheet("Connections");
    const evt  = sheet.getSheetByName("Events")      || sheet.insertSheet("Events");
    const connRows = conn.getDataRange().getValues().slice(1);
    const evtRows  = evt.getDataRange().getValues().slice(1);
    const connections = connRows.filter(r => r[0]).map(r => ({
      id: r[0], name: r[1], event: r[2], date: r[3],
      facts: [r[4], r[5], r[6]], weekKey: r[7]
    }));
    const events = evtRows.filter(r => r[0]).map(r => ({
      id: r[0], name: r[1], date: r[2], type: r[3], isNew: r[4] === true || r[4] === "TRUE"
    }));
    return ContentService
      .createTextOutput(JSON.stringify({ connections, events }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const payload = JSON.parse(e.postData.contents);
  const { action, data } = payload;

  if (action === "addConnection") {
    const conn = sheet.getSheetByName("Connections") || sheet.insertSheet("Connections");
    if (conn.getLastRow() === 0) {
      conn.appendRow(["ID","Name","Event","Date","Fact1","Fact2","Fact3","WeekKey"]);
    }
    conn.appendRow([data.id, data.name, data.event, data.date,
                    data.facts[0], data.facts[1], data.facts[2], data.weekKey]);
  }

  if (action === "addEvent") {
    const evt = sheet.getSheetByName("Events") || sheet.insertSheet("Events");
    if (evt.getLastRow() === 0) {
      evt.appendRow(["ID","Name","Date","Type","IsNew"]);
    }
    evt.appendRow([data.id, data.name, data.date, data.type, data.isNew]);
  }

  if (action === "deleteConnection") {
    const conn = sheet.getSheetByName("Connections");
    if (conn) {
      const rows = conn.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] == data.id) { conn.deleteRow(i + 1); break; }
      }
    }
  }

  if (action === "deleteEvent") {
    const evt = sheet.getSheetByName("Events");
    if (evt) {
      const rows = evt.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] == data.id) { evt.deleteRow(i + 1); break; }
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
`.trim();

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem("gg_script_url") || "");
  const [urlDraft, setUrlDraft] = useState("");
  const [setupStep, setSetupStep] = useState("url"); // url | script
  const [data, setData] = useState({ connections: [], events: [] });
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | "saving" | "ok" | "error"
  const [view, setView] = useState("dashboard");
  const [form, setForm] = useState({ name: "", event: "", date: today, facts: ["", "", ""] });
  const [eventForm, setEventForm] = useState({ name: "", date: today, type: "Social", isNew: false });
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [showSetup, setShowSetup] = useState(false);

  // ── API helpers ──
  const api = useCallback(async (action, body) => {
    if (!scriptUrl) return null;
    try {
      if (action === "getAll") {
        const r = await fetch(`${scriptUrl}?action=getAll`);
        return await r.json();
      } else {
        await fetch(scriptUrl, {
          method: "POST",
          body: JSON.stringify({ action, data: body }),
        });
        return { ok: true };
      }
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [scriptUrl]);

  // ── Load data on connect ──
  useEffect(() => {
    if (!scriptUrl) return;
    setLoading(true);
    api("getAll").then(res => {
      if (res?.connections) setData(res);
      setLoading(false);
    });
  }, [scriptUrl, api]);

  // ── Save script URL ──
  function connectSheet() {
    const url = urlDraft.trim();
    if (!url) return;
    localStorage.setItem("gg_script_url", url);
    setScriptUrl(url);
    setShowSetup(false);
  }

  function disconnect() {
    localStorage.removeItem("gg_script_url");
    setScriptUrl("");
    setData({ connections: [], events: [] });
    setUrlDraft("");
    setShowSetup(true);
    setSetupStep("url");
  }

  // ── Mutations ──
  async function addConnection() {
    if (!form.name || !form.event || form.facts.some(f => !f.trim())) return;
    const id = Date.now().toString();
    const weekKey = getWeekKey(form.date);
    const entry = { id, ...form, weekKey };
    setData(d => ({ ...d, connections: [...d.connections, entry] }));
    setForm({ name: "", event: "", date: today, facts: ["", "", ""] });
    setSyncStatus("saving");
    const res = await api("addConnection", entry);
    setSyncStatus(res?.ok ? "ok" : "error");
    setTimeout(() => setSyncStatus(null), 2500);
  }

  async function addEvent() {
    if (!eventForm.name) return;
    const id = Date.now().toString();
    const entry = { id, ...eventForm };
    setData(d => ({ ...d, events: [...d.events, entry] }));
    setEventForm({ name: "", date: today, type: "Social", isNew: false });
    setSyncStatus("saving");
    const res = await api("addEvent", entry);
    setSyncStatus(res?.ok ? "ok" : "error");
    setTimeout(() => setSyncStatus(null), 2500);
  }

  async function deleteConnection(id) {
    setData(d => ({ ...d, connections: d.connections.filter(c => c.id !== id) }));
    await api("deleteConnection", { id });
  }

  async function deleteEvent(id) {
    setData(d => ({ ...d, events: d.events.filter(e => e.id !== id) }));
    await api("deleteEvent", { id });
  }

  // ── Derived state ──
  const weeks = getLast20Weeks();
  const currentWeek = getCurrentWeekKey();
  const connByWeek = {};
  data.connections.forEach(c => {
    if (!connByWeek[c.weekKey]) connByWeek[c.weekKey] = [];
    connByWeek[c.weekKey].push(c);
  });
  const totalPeople = data.connections.length;
  const totalEvents = data.events.length;
  const newEventCount = data.events.filter(e => e.isNew).length;
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
    { key: "log", label: "Log", icon: "＋" },
    { key: "events", label: "Events", icon: "◎" },
    { key: "people", label: "People", icon: "◉" },
  ];

  const syncColor = syncStatus === "saving" ? "#888" : syncStatus === "ok" ? "#4a7c59" : syncStatus === "error" ? "#c0392b" : "transparent";
  const syncLabel = syncStatus === "saving" ? "Saving…" : syncStatus === "ok" ? "✓ Saved to Sheet" : syncStatus === "error" ? "⚠ Sync error" : "";

  // ─── Setup screens ────────────────────────────────────────────────────────
  if (!scriptUrl || showSetup) {
    return (
      <div style={{ fontFamily: "Georgia, serif", background: "#0f0f0f", minHeight: "100vh", color: "#e8e2d9", maxWidth: 480, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>Setup</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#e8e2d9", marginBottom: 24 }}>Connect your Sheet</div>

        {/* Step tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid #222" }}>
          {["url", "script"].map((s, i) => (
            <button key={s} onClick={() => setSetupStep(s)} style={{
              flex: 1, background: "none", border: "none", borderBottom: setupStep === s ? "2px solid #c8b89a" : "2px solid transparent",
              color: setupStep === s ? "#c8b89a" : "#555", padding: "8px 0 10px", cursor: "pointer",
              fontFamily: "Georgia, serif", fontSize: 12, letterSpacing: 1
            }}>
              {i + 1}. {s === "url" ? "Paste URL" : "Script code"}
            </button>
          ))}
        </div>

        {setupStep === "url" && (
          <div>
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 20 }}>
              This tracker stores your data in a Google Sheet you own. You need to deploy a small Apps Script as a Web App, then paste its URL here. Switch to the <span style={{ color: "#c8b89a" }}>Script code</span> tab to get the code.
            </p>
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 20 }}>
              <strong style={{ color: "#e8e2d9" }}>Quick steps:</strong><br />
              1. Open a new Google Sheet<br />
              2. Go to <em>Extensions → Apps Script</em><br />
              3. Paste the script from the other tab<br />
              4. Click <em>Deploy → New deployment → Web App</em><br />
              5. Set "Execute as: Me" and "Who has access: Anyone"<br />
              6. Copy the Web App URL and paste below
            </p>
            <label style={label}>Your Apps Script Web App URL</label>
            <input
              value={urlDraft}
              onChange={e => setUrlDraft(e.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              style={{ ...input, marginBottom: 14 }}
            />
            <button
              onClick={connectSheet}
              disabled={!urlDraft.trim()}
              style={{ width: "100%", background: urlDraft.trim() ? "#4a7c59" : "#1a1a1a", color: "#e8e2d9", border: "none", borderRadius: 4, padding: 14, fontSize: 15, cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: 700 }}
            >
              Connect Sheet →
            </button>
          </div>
        )}

        {setupStep === "script" && (
          <div>
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 16 }}>
              Copy all of this into your Apps Script editor, then deploy as a Web App.
            </p>
            <div style={{ background: "#0a0a0a", border: "1px solid #222", borderRadius: 4, padding: 14, fontSize: 11, color: "#a8d5b5", fontFamily: "monospace", lineHeight: 1.7, whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
              {APPS_SCRIPT}
            </div>
            <button
              onClick={() => { navigator.clipboard?.writeText(APPS_SCRIPT); }}
              style={{ marginTop: 12, width: "100%", background: "#1a1a2a", color: "#c8b89a", border: "1px solid #3a3a5c", borderRadius: 4, padding: 12, fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" }}
            >
              Copy to clipboard
            </button>
            <button onClick={() => setSetupStep("url")} style={{ marginTop: 10, width: "100%", background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" }}>
              ← Back to URL step
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Main app ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "Georgia, serif", background: "#0f0f0f", minHeight: "100vh", color: "#e8e2d9", maxWidth: 480, margin: "0 auto", paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 10px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#888", textTransform: "uppercase", marginBottom: 2 }}>Weekly Practice</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>One New Person</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {loading && <div style={{ fontSize: 10, color: "#555" }}>Loading…</div>}
          {syncLabel && <div style={{ fontSize: 10, color: syncColor }}>{syncLabel}</div>}
          <button onClick={() => setShowSetup(true)} style={{ background: "none", border: "none", color: "#333", fontSize: 10, cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: 1, marginTop: 4 }}>⚙ sheet</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", background: "#111" }}>
        {[
          { label: "People met", val: totalPeople },
          { label: "Streak", val: `${streak}w` },
          { label: "Events", val: totalEvents },
          { label: "New things", val: newEventCount },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: "12px 0", textAlign: "center", borderRight: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#c8b89a", letterSpacing: -0.5 }}>{s.val}</div>
            <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "16px 20px" }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <div style={sectionTitle}>20-Week Grid</div>
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
              <div style={sectionTitle}>This week</div>
              {(connByWeek[currentWeek] || []).length === 0 ? (
                <div style={{ background: "#161616", border: "1px dashed #2a2a2a", borderRadius: 6, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#555" }}>No one logged yet this week</div>
                  <button onClick={() => setView("log")} style={{ marginTop: 10, background: "none", border: "1px solid #444", color: "#c8b89a", borderRadius: 4, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif" }}>Log someone →</button>
                </div>
              ) : (
                (connByWeek[currentWeek] || []).map(c => (
                  <div key={c.id} style={{ background: "#161616", borderLeft: "3px solid #4a7c59", borderRadius: 4, padding: "10px 14px", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>at {c.event}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* LOG */}
        {view === "log" && (
          <div>
            <div style={sectionTitle}>Log a connection</div>
            {[
              { lbl: "Their name", field: "name", ph: "e.g. Siobhán" },
              { lbl: "Event / where you met", field: "event", ph: "e.g. Life drawing at LFAS" },
            ].map(({ lbl, field, ph }) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={label}>{lbl}</label>
                <input value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} placeholder={ph} style={input} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={input} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Three things about them</label>
              {form.facts.map((f, i) => (
                <input key={i} value={f}
                  onChange={e => { const facts = [...form.facts]; facts[i] = e.target.value; setForm({ ...form, facts }); }}
                  placeholder={["e.g. From Cork originally", "e.g. Works in architecture", "e.g. Learning Japanese pottery"][i]}
                  style={{ ...input, marginBottom: 8 }}
                />
              ))}
            </div>
            <button
              onClick={addConnection}
              disabled={!form.name || !form.event || form.facts.some(f => !f.trim())}
              style={{ width: "100%", background: (form.name && form.event && form.facts.every(f => f.trim())) ? "#4a7c59" : "#1a1a1a", color: "#e8e2d9", border: "none", borderRadius: 4, padding: 14, fontSize: 15, cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: 700 }}
            >
              {syncStatus === "saving" ? "Saving…" : syncStatus === "ok" ? "✓ Saved to Sheet" : "Save connection"}
            </button>
          </div>
        )}

        {/* EVENTS */}
        {view === "events" && (
          <div>
            <div style={sectionTitle}>Log an event</div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Event name</label>
              <input value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} placeholder="e.g. Anatomy of Acting workshop" style={input} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Date</label>
              <input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} style={input} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Type</label>
              <select value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })} style={input}>
                {["Social", "Art / Creative", "Fitness", "Cultural", "Professional", "Spiritual", "Other"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" id="isnew" checked={eventForm.isNew} onChange={e => setEventForm({ ...eventForm, isNew: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#c8b89a" }} />
              <label htmlFor="isnew" style={{ fontSize: 13, color: "#aaa" }}>New type of experience for me</label>
            </div>
            <button onClick={addEvent} disabled={!eventForm.name}
              style={{ width: "100%", background: eventForm.name ? "#3a3a5c" : "#1a1a1a", color: "#e8e2d9", border: "none", borderRadius: 4, padding: 14, fontSize: 15, cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: 700 }}>
              {syncStatus === "saving" ? "Saving…" : syncStatus === "ok" ? "✓ Saved to Sheet" : "Save event"}
            </button>

            {data.events.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={sectionTitle}>All events</div>
                {[...data.events].reverse().map(e => (
                  <div key={e.id} style={{ background: "#161616", borderLeft: `3px solid ${e.isNew ? "#c8b89a" : "#3a3a5c"}`, borderRadius: 4, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{e.type} · {e.date}{e.isNew ? " · ✦ new" : ""}</div>
                    </div>
                    <button onClick={() => deleteEvent(e.id)} style={{ background: "none", border: "none", color: "#444", fontSize: 18, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PEOPLE */}
        {view === "people" && (
          <div>
            <div style={sectionTitle}>Everyone you've met</div>
            {data.connections.length === 0 && (
              <div style={{ color: "#555", fontSize: 14, textAlign: "center", marginTop: 40 }}>No connections logged yet</div>
            )}
            {[...data.connections].reverse().map(c => (
              <div key={c.id} style={{ background: "#161616", borderLeft: "3px solid #4a7c59", borderRadius: 4, padding: "12px 14px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div onClick={() => setExpandedPerson(expandedPerson === c.id ? null : c.id)} style={{ cursor: "pointer", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{c.event} · {c.date}</div>
                  </div>
                  <button onClick={() => deleteConnection(c.id)} style={{ background: "none", border: "none", color: "#333", fontSize: 18, cursor: "pointer", padding: "0 0 0 8px" }}>×</button>
                </div>
                {expandedPerson === c.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #222" }}>
                    {(Array.isArray(c.facts) ? c.facts : [c.facts]).map((f, i) => (
                      <div key={i} style={{ fontSize: 13, color: "#aaa", marginBottom: 4 }}>
                        <span style={{ color: "#4a7c59", marginRight: 6 }}>◆</span>{f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
