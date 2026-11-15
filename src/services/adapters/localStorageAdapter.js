import { seedAll, DB_VERSION } from '@/mock';

// Storage adapter for DEMO mode (browser localStorage).
// Later, write an IndexedDB / RxDB adapter with the same methods (load, save, reset, ...) and nothing else changes.
const KEY = 'rac_mock_db_v3';
const SESSION = 'rac_session';
let cache = null;

const ok = () => typeof window !== 'undefined';
export const localStorageAdapter = {
  load() {
    if (cache) return cache;
    if (ok()) {
      try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d.version === DB_VERSION) { cache = d; return d; } } } catch { /* reseed below */ }
    }
    cache = seedAll();
    this.save(cache);
    return cache;
  },
  save(db) {
    cache = db;
    if (!ok()) return;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { console.warn('Demo storage is full. Changes are kept only until the page is refreshed.'); }
  },
  replace(db) { this.save(db); },
  reset() { cache = null; if (ok()) localStorage.removeItem(KEY); return this.load(); },
  getSession() { if (!ok()) return null; try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { return null; } },
  setSession(s) { if (ok()) localStorage.setItem(SESSION, JSON.stringify(s)); },
  clearSession() { if (ok()) localStorage.removeItem(SESSION); },
};
