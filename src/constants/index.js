export const CAR_STATUSES = ['Available', 'Booked', 'On Rent', 'Under Repair'];
export const BOOKING_STATUSES = ['Reserved', 'On Rent', 'Completed', 'Cancelled', 'Overdue'];
export const PAYMENT_METHODS = ['Cash', 'JazzCash', 'Easypaisa', 'Bank Transfer', 'Other Online Transfer'];
export const METHOD_ICON = {
  Cash: '/images/payments/cash.svg', JazzCash: '/images/payments/jazzcash.svg', Easypaisa: '/images/payments/easypaisa.svg',
  'Bank Transfer': '/images/payments/bank.svg', 'Other Online Transfer': '/images/payments/other.svg',
};
// type -> how it counts
export const PAYMENT_TYPES = ['Advance', 'Partial', 'Full', 'Security Deposit', 'Deposit Refund', 'Deposit Adjustment', 'Advance Refund'];
export const RENT_RECEIPT_TYPES = ['Advance', 'Partial', 'Full', 'Deposit Adjustment']; // rental income
export const EXPENSE_CATEGORIES = [
  { value: 'Petrol', car: true }, { value: 'Repair', car: true }, { value: 'Service', car: true }, { value: 'Oil Change', car: true },
  { value: 'Insurance & Tax', car: true }, { value: 'Salary', car: false }, { value: 'Office Expense', car: false }, { value: 'Other', car: false },
];
export const CAR_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => c.car).map((c) => c.value);
export const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'CNG'];
export const TRANSMISSIONS = ['Automatic', 'Manual'];
export const FUEL_LEVELS = ['Empty', '1/4', '1/2', '3/4', 'Full'];
export const CITIES = ['Lahore', 'Islamabad', 'Karachi', 'Rawalpindi', 'Faisalabad', 'Multan', 'Gujranwala', 'Sialkot', 'Sargodha', 'Gujrat', 'Bahawalpur'];
export const CUSTOMER_TYPES = ['Regular', 'VIP', 'Corporate'];
export const BRAND_MODELS = {
  Toyota: ['Corolla', 'Yaris', 'Fortuner', 'Hilux', 'Prado', 'Aqua'],
  Honda: ['Civic', 'City', 'BR-V', 'HR-V', 'Vezel'],
  Suzuki: ['Swift', 'Alto', 'Wagon R', 'Cultus', 'Jimny'],
  KIA: ['Sportage', 'Picanto', 'Stonic'],
  Hyundai: ['Tucson', 'Elantra', 'Sonata'],
  MG: ['HS', 'ZS'],
};
export const CAR_COLORS = ['White', 'Black', 'Silver', 'Grey', 'Blue', 'Red'];
export const PAGE_SIZES = [10, 12, 20, 50];
export const LOCATIONS = ['Office Branch', 'Airport', 'Gulberg', 'DHA', 'Customer Address'];
export const SYNC_STATES = {
  online: { label: 'Online', tone: 'success' },
  offline: { label: 'Offline', tone: 'neutral' },
  pending: { label: 'Pending Sync', tone: 'warning' },
  syncing: { label: 'Syncing…', tone: 'info' },
  synced: { label: 'Synced', tone: 'success' },
  failed: { label: 'Sync Failed', tone: 'danger' },
  conflict: { label: 'Conflict Detected', tone: 'danger' },
};
