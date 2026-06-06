/* ============================================================================
   ATOLL NAVIGATOR — localStorage persistence
   ========================================================================== */
const KEYS = {
  settings: 'atollsim_settings',
  eco:      'atollsim_eco',
  logs:     'atollsim_logs',
};

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export const storage = {
  loadSettings: (def) => load(KEYS.settings, def),
  saveSettings: (v)   => save(KEYS.settings, v),
  loadEco:      (def) => load(KEYS.eco, def),
  saveEco:      (v)   => save(KEYS.eco, v),
  loadLogs:     ()    => load(KEYS.logs, []),
  appendLog(entry) {
    const logs = load(KEYS.logs, []);
    logs.unshift(entry);
    if (logs.length > 60) logs.length = 60;
    save(KEYS.logs, logs);
    return logs;
  },
  clearLogs: () => save(KEYS.logs, []),
};
