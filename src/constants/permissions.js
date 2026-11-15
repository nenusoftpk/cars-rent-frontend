
/**
 * src/constants/permissions.js
 *
 * Frontend permission registry for Rent-a-Car SaaS.
 *
 * IMPORTANT:
 * - Permission identifiers must match the backend exactly.
 * - The backend remains the authority for authorization.
 * - Employee permissions are stored in MongoDB.
 * - dataScope ("own" / "business") is NOT a permission.
 * - Never convert unsupported frontend permissions into
 *   unrelated backend permissions.
 */

// ============================================================
// ROLES
// ============================================================

export const ROLES = Object.freeze({
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  EMPLOYEE: "employee",
});

// ============================================================
// PERMISSION IDENTIFIERS
// Exact match with backend defaultPermissions.js
// ============================================================

export const PERMISSIONS = Object.freeze({
  DASHBOARD: Object.freeze({
    VIEW: "dashboard.view",
  }),

  CUSTOMERS: Object.freeze({
    VIEW: "customers.view",
    CREATE: "customers.create",
    UPDATE: "customers.update",
    DELETE: "customers.delete",
    DOCUMENTS_VIEW: "customers.documents.view",
  }),

  CARS: Object.freeze({
    VIEW: "cars.view",
    CREATE: "cars.create",
    UPDATE: "cars.update",
    DELETE: "cars.delete",
    DOCUMENTS_VIEW: "cars.documents.view",
  }),

  DRIVERS: Object.freeze({
    VIEW: "drivers.view",
    CREATE: "drivers.create",
    UPDATE: "drivers.update",
    DELETE: "drivers.delete",
    DOCUMENTS_VIEW: "drivers.documents.view",
  }),

  BOOKINGS: Object.freeze({
    VIEW: "bookings.view",
    CREATE: "bookings.create",
    UPDATE: "bookings.update",
    CANCEL: "bookings.cancel",
    EXTEND: "bookings.extend",
  }),

  INSPECTIONS: Object.freeze({
    VIEW: "inspections.view",
    ISSUE: "inspections.issue",
    RETURN: "inspections.return",
  }),

  INVOICES: Object.freeze({
    VIEW: "invoices.view",
    PRINT: "invoices.print",
  }),

  PAYMENTS: Object.freeze({
    VIEW: "payments.view",
    CREATE: "payments.create",
    REFUND: "payments.refund",
  }),

  DEPOSITS: Object.freeze({
    VIEW: "deposits.view",
    RECEIVE: "deposits.receive",
    REFUND: "deposits.refund",
  }),

  LEDGER: Object.freeze({
    VIEW: "ledger.view",
    PRINT: "ledger.print",
  }),

  EXPENSES: Object.freeze({
    VIEW: "expenses.view",
    CREATE: "expenses.create",
    UPDATE: "expenses.update",
    DELETE: "expenses.delete",
  }),

  MAINTENANCE: Object.freeze({
    VIEW: "maintenance.view",
    CREATE: "maintenance.create",
    UPDATE: "maintenance.update",
    DELETE: "maintenance.delete",
  }),

  REPORTS: Object.freeze({
    VIEW: "reports.view",
    EXPORT: "reports.export",
  }),

  REMINDERS: Object.freeze({
    VIEW: "reminders.view",
  }),

  EMPLOYEES: Object.freeze({
    VIEW: "employees.view",
  }),

  SETTINGS: Object.freeze({
    VIEW: "settings.view",
    UPDATE: "settings.update",
  }),
});

// ============================================================
// ALL ALLOWED PERMISSIONS
// Exact backend list, including order
// ============================================================

export const ALLOWED_PERMISSIONS = Object.freeze([
  "dashboard.view",

  "customers.view",
  "customers.create",
  "customers.update",
  "customers.delete",
  "customers.documents.view",

  "cars.view",
  "cars.create",
  "cars.update",
  "cars.delete",
  "cars.documents.view",

  "drivers.view",
  "drivers.create",
  "drivers.update",
  "drivers.delete",
  "drivers.documents.view",

  "bookings.view",
  "bookings.create",
  "bookings.update",
  "bookings.cancel",
  "bookings.extend",

  "inspections.view",
  "inspections.issue",
  "inspections.return",

  "invoices.view",
  "invoices.print",

  "payments.view",
  "payments.create",
  "payments.refund",

  "deposits.view",
  "deposits.receive",
  "deposits.refund",

  "ledger.view",
  "ledger.print",

  "expenses.view",
  "expenses.create",
  "expenses.update",
  "expenses.delete",

  "maintenance.view",
  "maintenance.create",
  "maintenance.update",
  "maintenance.delete",

  "reports.view",
  "reports.export",

  "reminders.view",

  "employees.view",

  "settings.view",
  "settings.update",
]);

// ============================================================
// DEFAULT EMPLOYEE PERMISSIONS
// Exact backend defaults
// ============================================================

export const DEFAULT_EMPLOYEE_PERMISSIONS = Object.freeze([
  "dashboard.view",

  "customers.view",
  "customers.create",
  "customers.update",

  "cars.view",

  "bookings.view",
  "bookings.create",
  "bookings.update",

  "inspections.view",
  "inspections.issue",
  "inspections.return",

  "payments.view",

  "invoices.view",
  "invoices.print",

  "reminders.view",
]);

// Backward-compatible export used by older frontend code.
export const EMPLOYEE_DEFAULT = DEFAULT_EMPLOYEE_PERMISSIONS;

// ============================================================
// MODULE DEFINITIONS
// Used for grouping permissions in the UI
// ============================================================

export const MODULES = Object.freeze([
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Customers" },
  { key: "cars", label: "Cars" },
  { key: "drivers", label: "Drivers" },
  { key: "bookings", label: "Bookings" },
  { key: "inspections", label: "Car Issue / Return" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "deposits", label: "Security Deposits" },
  { key: "ledger", label: "Customer Ledger" },
  { key: "expenses", label: "Expenses" },
  { key: "maintenance", label: "Maintenance" },
  { key: "reports", label: "Reports" },
  { key: "reminders", label: "Reminders" },
  { key: "employees", label: "Staff / Users" },
  { key: "settings", label: "Settings" },
]);

// ============================================================
// ACTION DEFINITIONS
// All backend permission actions
// ============================================================

export const ACTIONS = Object.freeze([
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "update", label: "Update" },
  { key: "delete", label: "Delete" },
  { key: "issue", label: "Issue" },
  { key: "return", label: "Return" },
  { key: "cancel", label: "Cancel" },
  { key: "extend", label: "Extend" },
  { key: "print", label: "Print" },
  { key: "refund", label: "Refund" },
  { key: "receive", label: "Receive" },
  { key: "export", label: "Export" },
  { key: "documents.view", label: "View Documents" },
]);

// No backend equivalents for the old special permissions.
// Record visibility is controlled by user.dataScope.
export const SPECIAL = Object.freeze([]);

// ============================================================
// DATA SCOPES
// ============================================================

export const DATA_SCOPES = Object.freeze({
  OWN: "own",
  BUSINESS: "business",
});

// ============================================================
// INTERNAL HELPERS
// ============================================================

const ALLOWED_SET = new Set(ALLOWED_PERMISSIONS);

const normalizePermissionInput = (permissions) => {
  if (typeof permissions === "string") {
    return permissions ? [permissions] : [];
  }

  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions;
};

export const isValidPermission = (permission) =>
  typeof permission === "string" &&
  ALLOWED_SET.has(permission);

export const sanitizePermissions = (permissions = []) => {
  const input = normalizePermissionInput(permissions);

  return [...new Set(input.filter(isValidPermission))];
};

export const getDefaultEmployeePermissions = () =>
  [...DEFAULT_EMPLOYEE_PERMISSIONS];

// ============================================================
// ROLE HELPERS
// ============================================================

export const isSuperAdmin = (user) =>
  user?.role === ROLES.SUPER_ADMIN;

export const isAdmin = (user) =>
  user?.role === ROLES.ADMIN;

export const isEmployee = (user) =>
  user?.role === ROLES.EMPLOYEE;

export const isBusinessAdmin = (user) =>
  isAdmin(user);

// ============================================================
// PERMISSION CHECKING
// ============================================================

/**
 * Check a single permission or require ALL permissions.
 *
 * hasPerm(user, "cars.view")
 * hasPerm(user, ["cars.view", "cars.update"])
 *
 * Business admins bypass employee permission checks.
 * Super admins do NOT automatically bypass tenant permissions:
 * their platform authorization must be handled separately.
 */
export const hasPerm = (user, permission) => {
  if (!user) return false;

  const required = normalizePermissionInput(permission);

  if (!required.length) return true;

  if (!required.every(isValidPermission)) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (!isEmployee(user)) {
    return false;
  }

  const granted = new Set(
    sanitizePermissions(user.permissions)
  );

  return required.every((p) => granted.has(p));
};

/**
 * Check whether the user has at least one permission.
 */
export const hasAnyPerm = (user, permissions = []) => {
  if (!user) return false;

  const required = normalizePermissionInput(permissions);

  if (!required.length) return false;

  return required.some((permission) =>
    hasPerm(user, permission)
  );
};

/**
 * Check whether the user has every permission.
 */
export const hasAllPerms = (user, permissions = []) => {
  if (!user) return false;

  const required = normalizePermissionInput(permissions);

  if (!required.length) return false;

  return required.every((permission) =>
    hasPerm(user, permission)
  );
};

// Optional descriptive aliases
export const can = hasPerm;
export const canAny = hasAnyPerm;
export const canAll = hasAllPerms;

// ============================================================
// EMPLOYEE DATA-SCOPE HELPERS
// ============================================================

export const hasOwnDataScope = (user) =>
  isEmployee(user) &&
  user?.dataScope === DATA_SCOPES.OWN;

export const hasBusinessDataScope = (user) =>
  isAdmin(user) ||
  (
    isEmployee(user) &&
    user?.dataScope === DATA_SCOPES.BUSINESS
  );

// ============================================================
// MODULE PERMISSIONS
// ============================================================

export const getModulePermissions = (moduleKey) => {
  if (typeof moduleKey !== "string") {
    return [];
  }

  return ALLOWED_PERMISSIONS.filter(
    (permission) =>
      permission.startsWith(`${moduleKey}.`)
  );
};

export const getGrantedPermissions = (user) => {
  if (!user) return [];

  if (isAdmin(user)) {
    return [...ALLOWED_PERMISSIONS];
  }

  if (isEmployee(user)) {
    return sanitizePermissions(user.permissions);
  }

  return [];
};

// ============================================================
// PERMISSION METADATA
// ============================================================

export const getPermissionLabel = (permission) => {
  if (!isValidPermission(permission)) {
    return "";
  }

  const module = MODULES.find(({ key }) =>
    permission.startsWith(`${key}.`)
  );

  const action = permission.slice(
    permission.indexOf(".") + 1
  );

  const actionLabel =
    ACTIONS.find(({ key }) => key === action)?.label ||
    action.replaceAll(".", " ");

  return `${module?.label || "Unknown"} - ${actionLabel}`;
};
