// PATH: src/features/expenses/expenseConstants.js   (NEW FILE)
// Values are EXACTLY the backend enums (Expense.js / expenseValidation.js).
// car: 'required' | 'optional' | 'none'  -> whether the expense is tied to a car in the form

export const EXPENSE_CATEGORIES = [
  { value: 'fuel', label: 'Fuel / Petrol', car: 'required' },
  { value: 'repair', label: 'Repair', car: 'required' },
  { value: 'service', label: 'Servicing', car: 'required' },
  { value: 'oil_change', label: 'Oil Change', car: 'required' },
  { value: 'tyres', label: 'Tyres', car: 'required' },
  { value: 'brakes', label: 'Brakes', car: 'required' },
  { value: 'inspection', label: 'Inspection', car: 'required' },
  { value: 'insurance', label: 'Insurance', car: 'optional' },
  { value: 'tax', label: 'Tax', car: 'optional' },
  { value: 'insurance_tax', label: 'Insurance & Tax', car: 'optional' },
  { value: 'driver_payment', label: 'Driver Payment', car: 'optional', driver: true },
  { value: 'salary', label: 'Salary', car: 'none' },
  { value: 'rent', label: 'Rent', car: 'none' },
  { value: 'utilities', label: 'Utilities', car: 'none' },
  { value: 'office_expense', label: 'Office Expense', car: 'none' },
  { value: 'other', label: 'Other', car: 'optional' },
];

export const EXPENSE_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export const categoryOf = (value) => EXPENSE_CATEGORIES.find((c) => c.value === value) || { value, label: value, car: 'none' };
export const categoryLabel = (value) => categoryOf(value).label;
export const methodLabel = (value) => EXPENSE_METHODS.find((m) => m.value === value)?.label || value || '-';