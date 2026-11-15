import { subHours, subMinutes } from 'date-fns';
import { toLocalISO } from '@/lib/dates';
import { seedStaff } from './staff';
import { seedDrivers } from './drivers';
import { seedSettings } from './settings';
import { seedCars } from './cars';
import { seedCustomers } from './customers';
import { seedBookings } from './bookings';
import { seedExpenses } from './expenses';

export const DB_VERSION = 3;
const IMG = { photo: '/images/customers/', car: '/images/cars/' };

export function seedAll(now = new Date()) {
  const staff = seedStaff(); const drivers = seedDrivers(); const cars = seedCars(now);
  const customers = seedCustomers(staff, now);
  const { bookings, payments, counters } = seedBookings({ customers, cars, drivers, staff, now });
  const { expenses, counter } = seedExpenses({ cars, drivers, staff, now });

  // Documents list (customer papers, car papers, handover/return photos)
  const documents = []; let dn = 0;
  const doc = (ownerType, ownerId, ownerName, type, url, sensitive = false) => { dn += 1; documents.push({ id: `doc-${dn}`, ownerType, ownerId, ownerName, type, name: url.split('/').pop(), url, mime: url.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg', size: 40000 + (dn % 7) * 9000, uploadedAt: toLocalISO(subHours(now, dn * 11)), sensitive }); };
  customers.forEach((c) => { doc('customer', c.id, c.name, 'Customer Photo', c.photo); doc('customer', c.id, c.name, 'CNIC Front', c.cnicFront, true); doc('customer', c.id, c.name, 'CNIC Back', c.cnicBack, true); doc('customer', c.id, c.name, 'Driving Licence', c.licenseImage, true); });
  cars.forEach((c) => { doc('car', c.id, `${c.name} (${c.plate})`, 'Car Photo', c.image); doc('car', c.id, `${c.name} (${c.plate})`, 'Registration Document', c.registrationDoc); doc('car', c.id, `${c.name} (${c.plate})`, 'Insurance Document', c.insuranceDoc); });
  bookings.filter((b) => b.issue).slice(-24).forEach((b) => {
    const cu = customers.find((c) => c.id === b.customerId); const car = cars.find((c) => c.id === b.carId);
    const label = `${b.number} - ${cu.name} - ${car.plate}`;
    b.issue.photos.forEach((p) => doc('booking', b.id, label, 'Handover Photo', p));
    (b.returnInfo?.photos || []).forEach((p) => doc('booking', b.id, label, 'Return Photo', p));
  });

  const todayB = bookings.filter((b) => b.createdAt.slice(0, 10) === toLocalISO(now).slice(0, 10)).slice(-2);
  const activity = [
    ...todayB.map((b, i) => ({ id: `act-b${i}`, at: b.createdAt, type: 'booking', title: 'New Booking', text: `${customers.find((c) => c.id === b.customerId).name} - ${cars.find((c) => c.id === b.carId).name} (${b.days} Days)` })),
    { id: 'act-c', at: toLocalISO(subMinutes(now, 40)), type: 'customer', title: 'New Customer', text: `${customers[1].name} registered` },
    { id: 'act-p', at: toLocalISO(subMinutes(now, 95)), type: 'payment', title: 'Payment Received', text: `Rs. 25,000 - ${customers[2].name}` },
  ];

  return {
    version: DB_VERSION, seededAt: toLocalISO(now),
    counters: { booking: counters.booking, payment: counters.payment, expense: counter, customer: customers.length, car: cars.length, driver: drivers.length, staff: staff.length },
    staff, drivers, cars, customers, bookings, payments, expenses, documents, activity,
    completedReminders: [], requestIds: [],
    backups: [
      { id: 'bk-s1', at: toLocalISO(subHours(now, 30)), type: 'Automatic', size: '1.8 MB', status: 'Sample (mock)', note: 'Example entry - no real backup was made.' },
      { id: 'bk-s2', at: toLocalISO(subHours(now, 78)), type: 'Manual', size: '1.8 MB', status: 'Sample (mock)', note: 'Example entry - no real backup was made.' },
    ],
    sessions: [
      { id: 'ses-1', device: 'This browser', place: 'Lahore, Pakistan', at: toLocalISO(now), current: true },
      { id: 'ses-2', device: 'Chrome on Windows 11', place: 'Lahore, Pakistan', at: toLocalISO(subHours(now, 20)), current: false },
      { id: 'ses-3', device: 'Safari on iPhone', place: 'Lahore, Pakistan', at: toLocalISO(subHours(now, 52)), current: false },
    ],
    settings: seedSettings(),
  };
}
