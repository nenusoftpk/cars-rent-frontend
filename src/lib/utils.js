export const cn = (...a) => a.flat().filter(Boolean).join(' ');
export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
export const sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
export const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
export const clean = (o = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null && v !== 'all'));
export const initials = (n = '') => n.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
export const pluralize = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
