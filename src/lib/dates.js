import {
  format,
  parseISO,
  isValid,
  differenceInMinutes,
} from 'date-fns';

const prefs = {
  date: 'dd MMM yyyy',   // safe default
  time12: true,
};

export const setFormatPrefs = (p = {}) => {
  if (p.dateFormat) {
    // Force correct Unicode tokens so this never crashes again
    const safe = String(p.dateFormat)
      .replace(/DD/g, 'dd')
      .replace(/YYYY/g, 'yyyy');
    prefs.date = safe;
  }
  if (p.timeFormat) {
    prefs.time12 = p.timeFormat === '12h';
  }
};

export const parse = (v) => {
  if (!v) return null;

  // Already a Date object
  if (v instanceof Date) {
    return isValid(v) ? v : null;
  }

  // Try ISO first (what the API usually sends)
  let d = parseISO(String(v));
  if (isValid(d)) return d;

  // Fallback for native Date strings
  d = new Date(v);
  return isValid(d) ? d : null;
};

export const toLocalISO = (d) => format(d, "yyyy-MM-dd'T'HH:mm");
export const toDay = (d = new Date()) => format(d, 'yyyy-MM-dd');

export const dayOf = (v) => {
  const d = parse(v);
  return d ? format(d, 'yyyy-MM-dd') : '';
};

export const fmtDate = (v) => {
  const d = parse(v);
  return d ? format(d, prefs.date) : '-';
};

export const fmtTime = (v) => {
  const d = parse(v);
  return d
    ? format(d, prefs.time12 ? 'hh:mm a' : 'HH:mm')
    : '-';
};

export const fmtDateTime = (v) =>
  parse(v) ? `${fmtDate(v)}, ${fmtTime(v)}` : '-';

export const fmtShort = (v) => {
  const d = parse(v);
  return d ? format(d, 'dd MMM') : '-';
};

export const inRange = (v, from, to) => {
  const k = dayOf(v);
  if (!k) return false;
  if (from && k < from) return false;
  if (to && k > to) return false;
  return true;
};

export const splitDT = (v) => {
  const d = parse(v);
  return d
    ? { date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') }
    : { date: '', time: '10:00' };
};

export const joinDT = (date, time) =>
  date ? `${date}T${time || '10:00'}` : '';

export const minutesBetween = (a, b) =>
  parse(a) && parse(b)
    ? differenceInMinutes(parse(b), parse(a))
    : 0;

export const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const label = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${
    h < 12 ? 'AM' : 'PM'
  }`;
  return { value, label };
});

export const groupKey = (v, by) => {
  const d = parse(v);
  if (!d) return '';
  return by === 'year'
    ? format(d, 'yyyy')
    : by === 'month'
      ? format(d, 'yyyy-MM')
      : format(d, 'yyyy-MM-dd');
};

export const groupLabel = (k, by) => {
  if (by === 'year') return k;
  if (by === 'month') return format(parseISO(`${k}-01`), 'MMMM yyyy');
  return fmtDate(k);
};