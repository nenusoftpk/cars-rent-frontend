import { subDays, subMonths, startOfMonth, addDays } from 'date-fns';
import { rng } from '@/lib/rng';
import { toLocalISO } from '@/lib/dates';

const M = ['Cash', 'Cash', 'Cash', 'Cash', 'Easypaisa', 'Bank Transfer', 'JazzCash'];
export function seedExpenses({ cars, drivers, staff, now }) {
  const r = rng(404); const out = []; let n = 0;
  const add = (date, category, details, carId, supplier, amount, method) => {
    if (date > now) return; n += 1;
    out.push({ id: `exp-${n}`, date: toLocalISO(date), category, details, carId: carId || '', supplier: supplier || '', method: method || r.pick(M), amount, createdBy: 's-admin' });
  };
  const emps = staff.filter((s) => s.role === 'employee');
  for (let m = 0; m < 6; m += 1) {
    const base = startOfMonth(subMonths(now, m));
    emps.forEach((e, i) => add(addDays(base, 1), 'Salary', `Staff salary - ${e.name}`, '', e.name, [45000, 50000, 42000][i % 3], 'Bank Transfer'));
    drivers.filter((d) => d.status === 'Active').slice(0, 3).forEach((d) => add(addDays(base, 2), 'Salary', `Driver salary - ${d.name}`, '', d.name, 38000, 'Cash'));
    add(addDays(base, 3), 'Office Expense', 'Office rent', '', 'Gulberg Plaza', 80000, 'Bank Transfer');
    add(addDays(base, 5), 'Office Expense', 'Electricity, internet & cleaning', '', 'Utility bills', r.int(11000, 16000), 'Cash');
  }
  cars.forEach((c) => {
    const rep = c.status === 'Under Repair';
    for (let i = 0; i < 14; i += 1) add(subDays(now, r.int(0, 178)), 'Petrol', 'Petrol for car', c.id, r.pick(['PSO Gulberg', 'Shell Main Blvd', 'Total Parco']), r.pick([3000, 4000, 5000, 6000, 7000]));
    for (let i = 0; i < 3; i += 1) add(subDays(now, r.int(3, 170)), 'Service', r.pick(['Full service', 'Brake pads & filters', 'AC service']), c.id, r.pick(['Auto Care Lahore', 'Ghazi Motors', 'Quick Fix Garage']), r.int(8, 16) * 1000);
    for (let i = 0; i < 2; i += 1) add(subDays(now, r.int(3, 170)), 'Oil Change', 'Engine oil & filter change', c.id, 'Lube Station', r.pick([5500, 6500, 7500]));
    if (r() < 0.5 || rep) add(subDays(now, r.int(2, 150)), 'Repair', r.pick(['Brake repair', 'Suspension work', 'Dent & paint', 'Battery replacement']), c.id, 'Ghazi Motors', r.int(6, 36) * 1000);
    if (r() < 0.4) add(subDays(now, r.int(10, 170)), 'Insurance & Tax', 'Token tax / insurance payment', c.id, 'Excise Office', r.int(15, 40) * 1000, 'Bank Transfer');
  });
  out.sort((a, b) => a.date.localeCompare(b.date)).forEach((e, i) => { e.id = `exp-${i + 1}`; });
  return { expenses: out, counter: out.length };
}
