import { EMPLOYEE_DEFAULT } from '@/constants/permissions';

// DEMO ACCOUNTS (passwords are plain text only because this is a mock database)
export const seedStaff = () => [
  { id: 's-admin', name: 'Admin Owner', email: 'admin@rentacar.pk', mobile: '0300-1234567', password: 'admin123', role: 'admin', permissions: [], photo: '/images/admins/admin.svg', status: 'Active', createdAt: '2024-01-10T09:00' },
  { id: 's-1', name: 'Bilal Khan', email: 'bilal@rentacar.pk', mobile: '0321-4567890', password: 'employee123', role: 'employee', permissions: [...EMPLOYEE_DEFAULT], photo: '/images/admins/e1.svg', status: 'Active', createdAt: '2024-03-01T09:00' },
  { id: 's-2', name: 'Usman Tariq', email: 'usman@rentacar.pk', mobile: '0333-7654321', password: 'employee123', role: 'employee', permissions: [...EMPLOYEE_DEFAULT, 'financial:view', 'expenses:view'], photo: '/images/admins/e2.svg', status: 'Active', createdAt: '2024-05-12T09:00' },
  { id: 's-3', name: 'Hina Tariq', email: 'hina@rentacar.pk', mobile: '0345-1122334', password: 'employee123', role: 'employee', permissions: [...EMPLOYEE_DEFAULT, 'sensitive:view'], photo: '/images/admins/e3.svg', status: 'Active', createdAt: '2024-08-20T09:00' },
];
