import React, { useEffect, useState, useRef } from "react";
import HabitItem from "./HabitItem";
import { subscribeToPush, unsubscribeFromPush, getSubscription, urlBase64ToUint8Array } from "./registerServiceWorker";

const STORAGE_KEY = "habits_v2";

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.map(h => ({
      id: h.id || String(Date.now()) + Math.random().toString(36).slice(2),
      name: h.name || "Unnamed",
      history: Array.isArray(h.history) ? Array.from(new Set(h.history)) : [],
      createdAt: h.createdAt || new Date().toISOString(),
      reminder: h.reminder || { enabled: false, time: "09:00" },
      lastNotifiedDate: h.lastNotifiedDate || null,
      longestStreak: typeof h.longestStreak === "number" ? h.longestStreak : 0,
    }));
  } catch (e) {
    return [];
  }
}

function saveHabits(habits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

export default function App() {
  const [habits, setHabits] = useState(loadHabits);
  const [name, setName] = useState("");

  // import/export / undo snapshot
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const undoTimerRef = useRef(null);

  useEffect(() => {
    saveHabits(habits);
  }, [habits]);

  function addHabit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const newHabit = {
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      name: trimmed,
      history: [],
      createdAt: new Date().toISOString(),
      reminder: { enabled: false, time: "09:00" },
      lastNotifiedDate: null,
      longestStreak: 0,
    };
    setHabits([newHabit, ...habits]);
    setName("");
  }

  function updateHabit(updated) {
    setHabits(habits.map(h => (h.id === updated.id ? updated : h)));
  }

  function deleteHabit(id) {
    saveSnapshot();
    setHabits(habits.filter(h => h.id !== id));
  }

  function clearAll() {
    if (confirm("Clear all habits? This cannot be undone.")) {
      saveSnapshot();
      setHabits([]);
    }
  }

  function saveSnapshot() {
    setLastSnapshot(JSON.stringify(habits));
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setLastSnapshot(null), 10000);
  }

  function undo() {
    if (!lastSnapshot) return;
    try {
      const parsed = JSON.parse(lastSnapshot);
      setHabits(parsed);
      setLastSnapshot(null);
    } catch {}
  }

  // Export to file
  function exportJSON() {
    const dataStr = JSON.stringify(habits, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habits_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyJSON() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(habits));
      alert("Copied habits JSON to clipboard");
    } catch (e) {
      alert("Copy failed");
    }
  }

  // Import from text (merge or replace)
  function importFromText(text, { replace = false, resolveDuplicate = "keep" } = {}) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Invalid format: expected array of habits");
      // normalize
      const incoming = parsed.map(h => ({
        id: h.id || String(Date.now()) + Math.random().toString(36).slice(2),
        name: h.name || "Unnamed",
        history: Array.isArray(h.history) ? Array.from(new Set(h.history)) : [],
        createdAt: h.createdAt || new Date().toISOString(),
        reminder: h.reminder || { enabled: false, time: "09:00" },
        lastNotifiedDate: h.lastNotifiedDate || null,
        longestStreak: typeof h.longestStreak === "number" ? h.longestStreak : 0,
      }));

      saveSnapshot();
      if (replace) {
        setHabits(incoming);
      } else {
        // merge: keep existing unless conflict and resolveDuplicate says otherwise
        const map = new Map(habits.map(h => [h.id, h]));
        for (const h of incoming) {
          if (map.has(h.id)) {
            if (resolveDuplicate === "replace") map.set(h.id, h);
            else if (resolveDuplicate === "new") map.set(String(Date.now()) + Math.random().toString(36).slice(2), h);
            else {
              // keep existing
            }
          } else {
            map.set(h.id, h);
          }
        }
        setHabits(Array.from(map.values()));
      }
    } catch (e) {
      alert("Import failed: " + e.message);
    }
  }

  function handleFileImport(file, options) {
    const reader = new FileReader();
    reader.onload = () => importFromText(reader.result, options);
    reader.readAsText(file);
  }

  // Push subscription UI
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionJson, setSubscriptionJson] = useState(null);
  const [serverUrl, setServerUrl] = useState("http://localhost:4000");

  useEffect(() => {
    (async () => {
      const sub = await getSubscription();
      setSubscribed(!!sub);
      setSubscriptionJson(sub ? sub.toJSON() : null);
    })();
  }, []);

  async function doSubscribe() {
    try {
      const pubKey = import.meta.env.VITE_PUBLIC_VAPID_KEY;
      if (!pubKey) {
        alert("No VITE_PUBLIC_VAPID_KEY found. Add it to .env.local before building.");
        return;
      }
      const sub = await subscribeToPush(pubKey);
      setSubscribed(!!sub);
      setSubscriptionJson(sub ? sub.toJSON() : null);
      // optionally send to server
      if (confirm("Send subscription to server for push sending?")) {
        try {
          await fetch(`${serverUrl}/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub.toJSON() }),
          });
          alert("Subscription sent to server");
        } catch (e) {
          alert("Failed to send subscription to server: " + e.message);
        }
      }
    } catch (e) {
      alert("Subscribe failed: " + e.message);
    }
  }

  async function doUnsubscribe() {
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      setSubscriptionJson(null);
    } catch (e) {
      alert("Unsubscribe failed: " + e.message);
    }
  }

  function copySubscription() {
    if (!subscriptionJson) return alert("No subscription");
    navigator.clipboard.writeText(JSON.stringify(subscriptionJson)).then(() => alert("Copied subscription JSON"));
  }

  return (
    <div className="container improved">
      <header>
        <h1>Habit Tracker</h1>
        <p>Add daily habits, check them off, set reminders, export/import, and receive push reminders.</p>
      </header>

      <main>
        <form onSubmit={addHabit} className="add-form">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="New habit name (e.g. 'Meditate')"
            aria-label="New habit name"
          />
          <button type="submit" className="primary">Add</button>
        </form>

        <div className="controls">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={exportJSON} className="small">Export .json</button>
            <button onClick={copyJSON} className="small">Copy JSON</button>
            <label className="small" style={{ cursor: "pointer" }}>
              Import File
              <input type="file" accept="application/json" style={{ display: "none" }} onChange={e => handleFileImport(e.target.files[0], { replace: false })} />
            </label>
            <button className="small" onClick={() => {
              const text = prompt('Paste JSON here to import (array of habits)');
              if (text) importFromText(text, { replace: false });
            }}>Paste import</button>
            <button className="small" onClick={() => { saveSnapshot(); undo(); }} disabled={!lastSnapshot}>Undo</button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={serverUrl} onChange={e => setServerUrl(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #e6e9ef" }} />
            <button className="small" onClick={() => alert('Server URL is used when sending your push subscription. Example: http://localhost:4000')}>?</button>
            <button className="clear" onClick={clearAll} disabled={habits.length === 0}>Clear All</button>
          </div>
        </div>

        <section style={{ margin: '14px 0' }}>
          <h3>Push / Notifications</h3>
          <p style={{ color: 'var(--muted)' }}>Subscribe to push (requires VAPID public key set in VITE_PUBLIC_VAPID_KEY).</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {subscribed ? (
              <>
                <button className="small" onClick={doUnsubscribe}>Unsubscribe</button>
                <button className="small" onClick={copySubscription}>Copy subscription</button>
              </>
            ) : (
              <button className="small" onClick={doSubscribe}>Subscribe to Push</button>
            )}
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{subscribed ? 'Subscribed' : 'Not subscribed'}</div>
          </div>
        </section>

        {habits.length === 0 ? (
          <p className="empty">No habits yet — add one above to get started.</p>
        ) : (
          <div className="habits-list">
            {habits.map(habit => (
              <HabitItem
                key={habit.id}
                habit={habit}
                onChange={updateHabit}
                onDelete={() => deleteHabit(habit.id)}
              />
            ))}
          </div>
        )}
      </main>

      <footer>
        <small>Data stored locally in your browser (localStorage). Push requires a server to send pushes (see /server).</small>
      </footer>
    </div>
  );
}
