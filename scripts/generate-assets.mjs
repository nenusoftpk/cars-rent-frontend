// Generates all demo images (avatars, cars, payment logos, documents, banner, logo) as SVG files in /public/images.
// Run again any time with:  npm run assets
import fs from 'fs';
import path from 'path';
import { CUSTOMERS, DRIVERS, STAFF } from '../src/mock/people.mjs';

const write = (p, s) => {
  const f = path.join('public', 'images', p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s);
};
const rng = (seed) => { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/* ---------- Avatars ---------- */
const skins = ['#f1c9a5', '#e0ac82', '#c68e62', '#a8714a', '#8d5a3a'];
const hairs = ['#1b1b1b', '#2c1a10', '#4a2e1a', '#222222', '#3b2a20'];
const bgs = ['#dbeafe', '#e0e7ff', '#fce7f3', '#dcfce7', '#ffedd5', '#e0f2fe', '#f3e8ff'];
const shirts = ['#0b2a5b', '#1f2937', '#0866f5', '#334155', '#065f46', '#7c2d12', '#4c1d95', '#9d174d'];
function avatar(seed, female, tie = false) {
  const r = rng(seed); const p = (a) => a[Math.floor(r() * a.length)];
  const skin = p(skins), hair = p(hairs), bg = p(bgs), shirt = p(shirts);
  const beard = !female && r() > 0.55;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${bg}"/>
${female ? `<path d="M26 104 C16 55 28 18 60 18 C92 18 104 55 94 104 Z" fill="${hair}"/>` : ''}
<path d="M12 120 C14 92 36 84 60 84 C84 84 106 92 108 120 Z" fill="${shirt}"/>
${tie ? '<path d="M56 88 L64 88 L66 112 L60 118 L54 112 Z" fill="#0866f5"/>' : ''}
<rect x="52" y="70" width="16" height="18" rx="6" fill="${skin}"/>
<ellipse cx="60" cy="52" rx="23" ry="27" fill="${skin}"/>
${female ? `<path d="M36 52 C34 26 86 26 84 52 C76 38 52 36 36 52Z" fill="${hair}"/>` : `<path d="M36 48 C34 22 86 22 84 48 C78 36 44 36 36 48Z" fill="${hair}"/>`}
${beard ? `<path d="M38 56 C40 84 80 84 82 56 C76 70 44 70 38 56Z" fill="${hair}" opacity=".9"/>` : ''}
<circle cx="51" cy="54" r="2.4" fill="#222"/><circle cx="69" cy="54" r="2.4" fill="#222"/>
<path d="M52 66 Q60 72 68 66" stroke="#7a3b2e" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
}
const pad = (n) => String(n).padStart(2, '0');
CUSTOMERS.forEach((c, i) => write(`customers/c${pad(i + 1)}.svg`, avatar(100 + i * 7, c[1] === 'f')));
DRIVERS.forEach((c, i) => write(`drivers/d${i + 1}.svg`, avatar(300 + i * 11, c[1] === 'f')));
write('admins/admin.svg', avatar(11, false, true));
STAFF.slice(1).forEach((c, i) => write(`admins/e${i + 1}.svg`, avatar(500 + i * 13, c[1] === 'f')));

/* ---------- Cars ---------- */
function car(kind, color, { flip = false } = {}) {
  const bodies = {
    sedan: { b: 'M24 142 C24 128 30 120 46 116 L96 104 C112 98 126 80 150 66 C160 60 176 56 196 56 L232 56 C256 56 272 64 288 84 L304 102 C338 106 366 112 374 130 L376 146 C376 150 372 152 368 152 L32 152 C28 152 24 148 24 142 Z', w: 'M154 74 C164 68 178 64 196 64 L230 64 C246 64 258 70 270 86 L282 100 L128 100 C138 90 146 80 154 74 Z', pillar: 'M214 64 L214 100' },
    hatch: { b: 'M26 142 C26 126 34 118 50 114 L110 102 C126 98 134 70 168 60 L262 60 C278 60 292 70 302 90 L312 104 C346 108 368 116 372 132 L374 146 C374 150 370 152 366 152 L34 152 C30 152 26 148 26 142Z', w: 'M170 68 L258 68 C270 68 280 76 288 92 L294 102 L136 102 C146 84 156 72 170 68Z', pillar: 'M214 68 L214 102' },
    suv: { b: 'M24 146 C24 126 30 118 46 114 L92 106 L112 70 C116 60 126 54 140 54 L286 54 C300 54 310 60 318 74 L334 104 C356 108 372 116 376 132 L378 148 C378 152 374 154 370 154 L32 154 C28 154 24 150 24 146Z', w: 'M124 70 C126 66 132 62 140 62 L282 62 C290 62 296 66 302 76 L314 102 L112 102 Z', pillar: 'M204 62 L204 102 M256 62 L262 102' },
  };
  const k = bodies[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
<g ${flip ? 'transform="translate(400 0) scale(-1 1)"' : ''}>
<ellipse cx="200" cy="170" rx="165" ry="9" fill="#0b1c44" opacity=".16"/>
<circle cx="102" cy="150" r="31" fill="#0c1220"/><circle cx="298" cy="150" r="31" fill="#0c1220"/>
<path d="${k.b}" fill="${color}"/><path d="${k.b}" fill="url(#g)"/>
<path d="${k.w}" fill="#1c2a44"/><path d="${k.w}" fill="#9fc3ee" opacity=".35"/>
<path d="${k.pillar}" stroke="${color}" stroke-width="5"/>
<rect x="24" y="124" width="8" height="14" rx="3" fill="#e11d48"/><path d="M364 118 L376 126 L366 132Z" fill="#fff7c2"/>
<rect x="212" y="112" width="26" height="4" rx="2" fill="#000" opacity=".25"/>
<g><circle cx="102" cy="150" r="26" fill="#151a22"/><circle cx="102" cy="150" r="14" fill="#cfd6df"/><circle cx="102" cy="150" r="4.5" fill="#6b7686"/>
<circle cx="298" cy="150" r="26" fill="#151a22"/><circle cx="298" cy="150" r="14" fill="#cfd6df"/><circle cx="298" cy="150" r="4.5" fill="#6b7686"/></g></g></svg>`;
}
const CARS = [
  ['toyota-corolla', 'sedan', '#f4f6fa'], ['honda-civic', 'sedan', '#15181f'], ['suzuki-swift', 'hatch', '#f1f3f6'], ['toyota-fortuner', 'suv', '#1a1d24'],
  ['honda-brv', 'suv', '#f3f4f7'], ['toyota-yaris', 'sedan', '#eef0f4'], ['suzuki-wagonr', 'hatch', '#23262d'], ['kia-sportage', 'suv', '#e9ecf1'],
  ['honda-city', 'sedan', '#9aa4b2'], ['hyundai-tucson', 'suv', '#b8bec8'], ['suzuki-alto', 'hatch', '#c93b3b'], ['toyota-corolla-2', 'sedan', '#2b4a8a'],
];
CARS.forEach(([n, k, c]) => write(`cars/${n}.svg`, car(k, c)));

/* ---------- Payment logos (stylised placeholders; replace with official logos if you have the rights) ---------- */
const pay = (bg, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/>${inner}</svg>`;
write('payments/cash.svg', pay('#e6f7ef', '<rect x="8" y="18" width="48" height="28" rx="5" fill="#00b873"/><circle cx="32" cy="32" r="8" fill="#e6f7ef"/><text x="32" y="36" font-size="11" font-weight="700" text-anchor="middle" fill="#00b873" font-family="Arial">Rs</text>'));
write('payments/jazzcash.svg', pay('#e11d2e', '<text x="32" y="30" font-size="15" font-weight="800" text-anchor="middle" fill="#ffd400" font-family="Arial">Jazz</text><text x="32" y="46" font-size="13" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial">Cash</text>'));
write('payments/easypaisa.svg', pay('#e8f8ee', '<circle cx="32" cy="32" r="21" fill="#1ea54b"/><text x="32" y="43" font-size="32" font-weight="800" text-anchor="middle" fill="#fff" font-family="Arial">e</text>'));
write('payments/bank.svg', pay('#e8f1ff', '<path d="M32 10 L54 24 H10 Z" fill="#0866f5"/><rect x="14" y="27" width="6" height="19" fill="#0866f5"/><rect x="26" y="27" width="6" height="19" fill="#0866f5"/><rect x="38" y="27" width="6" height="19" fill="#0866f5"/><rect x="10" y="48" width="44" height="5" rx="2" fill="#0b2a5b"/>'));
write('payments/other.svg', pay('#f1f5f9', '<rect x="10" y="18" width="44" height="30" rx="6" fill="#64748b"/><rect x="40" y="29" width="14" height="10" rx="3" fill="#cbd5e1"/><circle cx="46" cy="34" r="2" fill="#475569"/>'));

/* ---------- Documents (sample, clearly watermarked) ---------- */
const doc = (title, color, lines, seed) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" rx="12" fill="#f8fafc" stroke="#cbd5e1"/><rect width="320" height="34" rx="12" fill="${color}"/><rect y="20" width="320" height="14" fill="${color}"/><text x="160" y="23" font-size="11" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial">${title}</text>
<rect x="16" y="50" width="70" height="88" rx="6" fill="#cbd5e1"/><circle cx="51" cy="82" r="14" fill="#94a3b8"/><path d="M26 130 C30 108 72 108 76 130Z" fill="#94a3b8"/>
${lines.map((l, i) => `<rect x="102" y="${54 + i * 20}" width="${l}" height="8" rx="4" fill="#cbd5e1"/>`).join('')}
<text x="160" y="176" font-size="22" font-weight="800" text-anchor="middle" fill="#0b1c44" opacity=".08" font-family="Arial" letter-spacing="6">SAMPLE</text>
<rect x="16" y="150" width="${120 + (seed % 5) * 20}" height="7" rx="3.5" fill="#e2e8f0"/><rect x="16" y="164" width="90" height="7" rx="3.5" fill="#e2e8f0"/></svg>`;
write('docs/cnic-front.svg', doc('ISLAMIC REPUBLIC OF PAKISTAN - NIC', '#0f7a3d', [160, 120, 140, 100], 1));
write('docs/cnic-back.svg', doc('NATIONAL IDENTITY CARD (BACK)', '#0f7a3d', [180, 150, 120, 150], 3));
write('docs/licence.svg', doc('DRIVING LICENCE - PUNJAB', '#0866f5', [150, 130, 160, 90], 2));
write('docs/registration.svg', doc('VEHICLE REGISTRATION BOOK', '#7c3aed', [150, 110, 160, 120], 4));
write('docs/insurance.svg', doc('MOTOR INSURANCE POLICY', '#ea580c', [160, 140, 100, 150], 0));
const shot = (label, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" rx="12" fill="#e8eef8"/><g transform="translate(40 30) scale(.6)">${car('sedan', color).replace(/<svg[^>]*>|<\/svg>/g, '')}</g><rect x="0" y="168" width="320" height="32" fill="#0b1c44" opacity=".85"/><text x="160" y="189" font-size="13" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial">${label}</text></svg>`;
['Front view', 'Rear view', 'Left side', 'Right side', 'Interior', 'Meter reading'].forEach((l, i) => write(`docs/condition-${i + 1}.svg`, shot(l, ['#f4f6fa', '#e9ecf1', '#cfd5de'][i % 3])));

/* ---------- Logo (white, for dark sidebar) + dark variant (for prints) ---------- */
const logo = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 100"><path d="M34 50 C44 32 72 22 110 20 C150 18 186 30 206 50" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M52 50 C60 38 84 31 112 30 C142 29 166 36 184 50" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity=".7"/><circle cx="82" cy="52" r="7" fill="none" stroke="${c}" stroke-width="2.5"/><circle cx="160" cy="52" r="7" fill="none" stroke="${c}" stroke-width="2.5"/>
<text x="120" y="78" font-size="24" font-weight="600" text-anchor="middle" fill="${c}" font-family="Georgia,serif" letter-spacing="5">RENT A CAR</text><text x="120" y="94" font-size="7.5" text-anchor="middle" fill="${c}" font-family="Arial" letter-spacing="3" opacity=".85">MANAGEMENT SYSTEM</text></svg>`;
write('logo.svg', logo('#ffffff'));
write('logo-dark.svg', logo('#0b1c44'));
fs.writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0866f5"/><path d="M12 38 C16 28 26 24 32 24 C40 24 48 28 52 38 L52 44 L12 44Z" fill="#fff"/><circle cx="22" cy="46" r="5" fill="#06172f"/><circle cx="42" cy="46" r="5" fill="#06172f"/></svg>`);

/* ---------- Banner: Lahore sunset + minarets + white sedan ---------- */
const mosque = `<g fill="#120f2b" opacity=".9"><rect x="560" y="150" width="520" height="80"/><path d="M700 150 C700 100 760 86 820 86 C880 86 940 100 940 150Z"/><path d="M600 150 C600 128 620 118 640 118 C660 118 680 128 680 150Z"/><path d="M960 150 C960 128 980 118 1000 118 C1020 118 1040 128 1040 150Z"/><rect x="814" y="62" width="12" height="26"/><circle cx="820" cy="58" r="6"/>
<rect x="540" y="60" width="16" height="170"/><rect x="536" y="56" width="24" height="8"/><path d="M538 56 C538 44 558 44 558 56Z"/><rect x="1084" y="60" width="16" height="170"/><rect x="1080" y="56" width="24" height="8"/><path d="M1082 56 C1082 44 1102 44 1102 56Z"/>
<rect x="470" y="110" width="12" height="120"/><path d="M468 110 C468 98 484 98 484 110Z"/><rect x="1156" y="110" width="12" height="120"/><path d="M1154 110 C1154 98 1170 98 1170 110Z"/></g>`;
const banner = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 240" preserveAspectRatio="xMaxYMid slice"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1535"/><stop offset=".35" stop-color="#2d2a6e"/><stop offset=".62" stop-color="#b4506a"/><stop offset=".85" stop-color="#f09a50"/><stop offset="1" stop-color="#f7c36a"/></linearGradient><radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd58a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient></defs>
<rect width="1600" height="240" fill="url(#sky)"/><circle cx="820" cy="150" r="220" fill="url(#sun)"/>
<g fill="#fff" opacity=".6"><circle cx="300" cy="30" r="1.5"/><circle cx="420" cy="55" r="1.2"/><circle cx="640" cy="22" r="1.4"/><circle cx="1000" cy="18" r="1.3"/><circle cx="1220" cy="40" r="1.5"/></g>
${mosque}
<g fill="#0e0c22" opacity=".8"><circle cx="420" cy="196" r="34"/><rect x="416" y="196" width="8" height="40"/><circle cx="1260" cy="190" r="38"/><rect x="1256" y="190" width="8" height="46"/></g>
<rect y="214" width="1600" height="26" fill="#0b0a1e"/>
<g transform="translate(1130 18) scale(.98)">${car('sedan', '#f5f7fb').replace(/<svg[^>]*>|<\/svg>|<defs>.*?<\/defs>/gs, '')}</g>
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
<text x="900" y="188" font-size="46" font-style="italic" fill="#fff" font-family="'Brush Script MT','Segoe Script',cursive" opacity=".95">Drive Your Dreams</text><text x="905" y="212" font-size="11" fill="#fff" font-family="Arial" letter-spacing="4" opacity=".8">RENT  •  EXPLORE  •  REPEAT</text></svg>`;
write('banner.svg', banner);
console.log('Assets generated in public/images');
