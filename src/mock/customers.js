import { CUSTOMERS } from './people.mjs';
import { rng } from '@/lib/rng';

const pad = (n) => String(n).padStart(2, '0');
const TYPES = { 0: 'VIP', 3: 'Regular', 6: 'Corporate', 10: 'VIP', 15: 'Corporate', 20: 'Regular' };
export function seedCustomers(staff, now = new Date()) {
  const r = rng(21); const emps = staff.filter((s) => s.role === 'employee');
  return CUSTOMERS.map(([name, g, city], i) => {
    const code = [35202, 35201, 61101, 35200, 42101, 37405, 33100][Math.floor(r() * 7)];
    const created = new Date(now); created.setDate(created.getDate() - (i < 4 ? i * 6 + 1 : 20 + Math.floor(r() * 380)));
    return {
      id: `cus-${i + 1}`, name, gender: g, city,
      mobile: `03${r.int(0, 4)}${r.int(0, 9)}-${r.int(1000000, 9999999)}`,
      cnic: `${code}-${r.int(1000000, 9999999)}-${r.int(1, 9)}`,
      address: `${r.pick(['House', 'Street', 'Flat'])} ${r.int(2, 140)}, ${r.pick(['DHA Phase 5', 'Gulberg III', 'Model Town', 'Johar Town', 'Bahria Town', 'Cantt', 'Wapda Town', 'Garden Town'])}`,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@email.com`,
      type: TYPES[i] || '', status: i === 14 ? 'Inactive' : 'Active',
      licenseNo: `LHR-${r.int(2012, 2023)}-${r.int(100000, 999999)}`,
      photo: `/images/customers/c${pad(i + 1)}.svg`, cnicFront: '/images/docs/cnic-front.svg', cnicBack: '/images/docs/cnic-back.svg', licenseImage: '/images/docs/licence.svg',
      openingBalance: i === 9 ? 3500 : 0,
      createdBy: emps[i % emps.length].id, createdAt: created.toISOString().slice(0, 16),
    };
  });
}
