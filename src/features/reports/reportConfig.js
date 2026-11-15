import { formatPKR } from '@/lib/money';
import { fmtDate, fmtDateTime } from '@/lib/dates';

const KIND = {
  money: [(v) => formatPKR(v), 'right'],
  date: [fmtDate],
  datetime: [fmtDateTime],
  text: [(v) => v ?? '—'],
  int: [(v) => v ?? 0, 'right'],
  status: [(v) => v ?? '—'],
};

const c = (key, header, kind = 'text', extra = {}) => {
  const def = KIND[kind] || KIND.text;
  return {
    key,
    header,
    kind,
    fmt: def[0],
    align: def[1],
    sortable: true,
    ...extra,
  };
};

export const REPORTS = [
  {
    group: 'Cars',
    items: [
      {
        id: 'cars-status',
        label: 'All Cars and Status',
        filters: ['status', 'car'],
        statuses: ['Available', 'Booked', 'On Rent', 'Maintenance', 'Out of Service'],
        cols: [
          c('name', 'Car'),
          c('numberPlate', 'Number Plate'),
          c('status', 'Status', 'status'),
          c('dailyRent', 'Rent / Day', 'money'),
          c('odometer', 'Meter (km)', 'int'),
          c('fuelType', 'Fuel'),
          c('transmission', 'Transmission'),
        ],
      },
    ],
  },
  {
    group: 'Customers & Bookings',
    items: [
      {
        id: 'customers',
        label: 'Customer Report',
        dateLabel: 'Created date',
        filters: ['date', 'customer'],
        cols: [
          c('name', 'Customer'),
          c('phone', 'Mobile'),
          c('email', 'Email'),
          c('city', 'City'),
          c('type', 'Type'),
          c('status', 'Status', 'status'),
          c('createdAt', 'Joined', 'date'),
        ],
      },
      {
        id: 'bookings',
        label: 'Booking Report',
        dateLabel: 'Pickup date',
        filters: ['date', 'customer', 'car', 'status', 'staff'],
        statuses: ['Reserved', 'On Rent', 'Completed', 'Cancelled'],
        cols: [
          c('bookingNumber', 'Booking No'),
          c('pickupDate', 'Pickup', 'datetime'),
          c('returnDate', 'Return', 'datetime'),
          c('customer.name', 'Customer'),
          c('car.name', 'Car'),
          c('status', 'Status', 'status'),
          c('totalAmount', 'Total', 'money'),
        ],
      },
      {
        id: 'drivers',
        label: 'Driver Report',
        filters: ['status'],
        statuses: ['Available', 'Assigned', 'Inactive'],
        cols: [
          c('name', 'Driver'),
          c('phone', 'Mobile'),
          c('status', 'Status', 'status'),
          c('paymentType', 'Pay Type'),
          c('paymentRate', 'Rate', 'money'),
          c('totalBookings', 'Bookings', 'int'),
        ],
      },
    ],
  },
  {
    group: 'Money',
    items: [
      {
        id: 'payments',
        label: 'Payment Report',
        money: true,
        dateLabel: 'Payment date',
        filters: ['date'],
        cols: [
          c('paymentNumber', 'Payment No'),
          c('paymentDate', 'Date', 'date'),
          c('method', 'Method'),
          c('type', 'Type'),
          c('amount', 'Amount', 'money'),
          c('booking.bookingNumber', 'Booking'),
        ],
      },
      {
        id: 'expenses',
        label: 'Expense Report',
        money: true,
        dateLabel: 'Expense date',
        filters: ['date', 'car'],
        cols: [
          c('title', 'Title'),
          c('expenseDate', 'Date', 'date'),
          c('category', 'Category'),
          c('amount', 'Amount', 'money'),
          c('car.name', 'Car'),
          c('paymentMethod', 'Method'),
        ],
      },
      {
        id: 'income-expense',
        label: 'Income & Expense Summary',
        money: true,
        dateLabel: 'Period',
        filters: ['date', 'car'],
        cols: [
          c('earnedRentalRevenue', 'Earned Revenue', 'money'),
          c('cashReceived', 'Cash Received', 'money'),
          c('totalCosts', 'Total Costs', 'money'),
          c('estimatedOperatingProfit', 'Operating Profit', 'money'),
        ],
      },
    ],
  },
];

export const FLAT = REPORTS.flatMap((g) => g.items);

export const totalsRow = (cfg, totals) =>
  Object.fromEntries(
    cfg.cols
      .filter((x) => totals?.[x.key] != null)
      .map((x) => [x.header, x.fmt ? x.fmt(totals[x.key]) : totals[x.key]])
  );