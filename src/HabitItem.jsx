import React, { useMemo, useState } from "react";

/* Utilities */
function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseYMD(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtShort(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function getDaysArray(days = 7) {
  const arr = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.push(d);
  }
  return arr; // [today, yesterday, ...]
}

function computeStreak(historySet) {
  const today = new Date();
  let cursor = new Date(today);
  const todayStr = localDateString(today);
  if (!historySet.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1); // start from yesterday
  }
  let streak = 0;
  while (true) {
    const s = localDateString(cursor);
    if (historySet.has(s)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function computeLongestStreak(historyArr) {
  if (!historyArr || historyArr.length === 0) return 0;
  const uniq = Array.from(new Set(historyArr)).sort(); // ascending YYYY-MM-DD
  let longest = 0;
  let current = 1;
  for (let i = 1; i < uniq.length; i++) {
    const prev = parseYMD(uniq[i - 1]);
    const curr = parseYMD(uniq[i]);
    const diff = (curr - prev) / (24 * 60 * 60 * 1000);
    if (diff === 1) {
      current++;
    } else if (diff > 1) {
      if (current > longest) longest = current;
      current = 1;
    }
  }
  if (current > longest) longest = current;
  return longest;
}

/* Component */
export default function HabitItem({ habit, onChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  const historySet = useMemo(() => new Set(habit.history || []), [habit.history]);

  const streak = useMemo(() => computeStreak(historySet), [historySet]);
  const longest = useMemo(() => computeLongestStreak(habit.history || []), [habit.history]);

  function persist(updated) {
    const unique = Array.from(new Set((updated.history || []).map(String)));
    unique.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    updated.history = unique;
    updated.longestStreak = computeLongestStreak(updated.history);
    onChange(updated);
  }

  function toggleDay(date) {
    const dayStr = localDateString(date);
    const newHistory = new Set(habit.history || []);
    if (newHistory.has(dayStr)) {
      newHistory.delete(dayStr);
    } else {
      newHistory.add(dayStr);
    }
    persist({ ...habit, history: Array.from(newHistory) });
  }

  function updateName(newName) {
    persist({ ...habit, name: newName });
  }

  function toggleReminder(enabled) {
    persist({ ...habit, reminder: { ...(habit.reminder || { time: "09:00" }), enabled } });
  }
  function updateReminderTime(timeStr) {
    persist({ ...habit, reminder: { ...(habit.reminder || { enabled: false, time: "09:00" }), time: timeStr } });
  }

  const days = getDaysArray(7);
  const doneCount = days.reduce((acc, d) => acc + (historySet.has(localDateString(d)) ? 1 : 0), 0);
  const pct = Math.round((doneCount / days.length) * 100);

  return (
    <div className="habit-item improved">
      <div className="habit-main">
        <div className="title-row">
          <div className="title-left">
            <strong className="habit-name">{habit.name}</strong>
            <div className="badges">
              <span className="badge current">Streak: <strong>{streak}</strong></span>
              <span className="badge muted">Longest: <strong>{habit.longestStreak ?? longest}</strong></span>
            </div>
          </div>

          <div className="controls-right">
            <button className="small" onClick={() => setEditing(s => !s)} aria-expanded={editing}>
              {editing ? "Done" : "Edit"}
            </button>
            <button className="delete small" onClick={onDelete} title="Delete habit">Delete</button>
          </div>
        </div>

        <div className="progress-row">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-text">{doneCount}/{days.length} this week</div>
        </div>

        <div className="days">
          {days.map((d, idx) => {
            const label = idx === 0 ? "Today" : fmtShort(d);
            const checked = historySet.has(localDateString(d));
            return (
              <label key={localDateString(d)} className={`day ${checked ? "done" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDay(d)}
                  aria-label={`Toggle ${habit.name} for ${label}`}
                />
                <span className="day-label">{idx === 0 ? "Today" : fmtShort(d)}</span>
              </label>
            );
          })}
        </div>

        {editing && (
          <div className="edit-panel">
            <label className="row">
              <div className="row-left">Rename</div>
              <input className="row-right" value={habit.name} onChange={e => updateName(e.target.value)} />
            </label>

            <label className="row">
              <div className="row-left">Reminder</div>
              <div className="row-right row-inline">
                <input
                  type="time"
                  value={(habit.reminder && habit.reminder.time) || "09:00"}
                  onChange={e => updateReminderTime(e.target.value)}
                />
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={(habit.reminder && habit.reminder.enabled) || false}
                    onChange={e => toggleReminder(e.target.checked)}
                  />
                  <span className="switch-slider" />
                </label>
              </div>
            </label>

            <div className="meta small muted">Last notified: {habit.lastNotifiedDate || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
