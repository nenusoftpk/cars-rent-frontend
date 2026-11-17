
/**
 * src/constants/navigation.js
 *
 * Centralized sidebar navigation for Rent-a-Car SaaS.
 *
 * All permission identifiers come from backend
 * defaultPermissions.js.
 *
 * Some pages combine multiple backend modules.
 * Those pages use "anyPerm" for sidebar visibility.
 *
 * Page-level actions must still check their own
 * specific permissions.
 */

import {
  LayoutDashboard,
  Users,
  Car,
  CalendarPlus,
  CalendarDays,
  ClipboardCheck,
  Receipt,
  BookOpen,
  WalletCards,
  UserRound,
  ShieldCheck,
  FileBarChart,
  Bell,
  Settings,
  FileText,
  // DatabaseBackup,
} from "lucide-react";

import {
  PERMISSIONS as P,
  hasPerm,
  hasAnyPerm,
  isAdmin,
} from "@/constants/permissions";

// ============================================================
// NAVIGATION ITEMS
// ============================================================

export const NAV_ITEMS = Object.freeze([
  // ----------------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------------
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    perm: P.DASHBOARD.VIEW,
    exact: true,
  },

  // ----------------------------------------------------------
  // CUSTOMERS
  // ----------------------------------------------------------
  {
    href: "/customers",
    label: "Customers",
    icon: Users,
    perm: P.CUSTOMERS.VIEW,
  },

  // ----------------------------------------------------------
  // CARS
  // ----------------------------------------------------------
  {
    href: "/cars",
    label: "Cars",
    icon: Car,
    perm: P.CARS.VIEW,
  },

  // ----------------------------------------------------------
  // NEW BOOKING
  // ----------------------------------------------------------
  {
    href: "/bookings/new",
    label: "New Booking",
    icon: CalendarPlus,
    perm: P.BOOKINGS.CREATE,
    exact: true,
  },

  // ----------------------------------------------------------
  // ALL BOOKINGS
  // ----------------------------------------------------------
  {
    href: "/bookings",
    label: "All Bookings",
    icon: CalendarDays,
    perm: P.BOOKINGS.VIEW,
    exact: true,
  },

  // ----------------------------------------------------------
  // CAR ISSUE / RETURN
  // ----------------------------------------------------------
  {
    href: "/car-issue-return",
    label: "Car Issue / Return",
    icon: ClipboardCheck,

    anyPerm: [
      P.INSPECTIONS.VIEW,
      P.INSPECTIONS.ISSUE,
      P.INSPECTIONS.RETURN,
    ],
  },

  // ----------------------------------------------------------
  // BILLING & PAYMENTS
  // ----------------------------------------------------------
  {
    href: "/billing",
    label: "Billing & Payments",
    icon: Receipt,

    anyPerm: [
      P.INVOICES.VIEW,
      P.INVOICES.PRINT,

      P.PAYMENTS.VIEW,
      P.PAYMENTS.CREATE,
      P.PAYMENTS.REFUND,

      P.DEPOSITS.VIEW,
      P.DEPOSITS.RECEIVE,
      P.DEPOSITS.REFUND,
    ],
  },

  // ----------------------------------------------------------
  // CUSTOMER LEDGER
  // ----------------------------------------------------------
  {
    href: "/customer-ledger",
    label: "Customer Ledger (Khata)",
    icon: BookOpen,
    perm: P.LEDGER.VIEW,
  },

  // ----------------------------------------------------------
  // INCOME & EXPENSES
  // ----------------------------------------------------------
  {
    href: "/income-expenses",
    label: "Income & Expenses",
    icon: WalletCards,

    anyPerm: [
      P.EXPENSES.VIEW,
      P.PAYMENTS.VIEW,
      P.REPORTS.VIEW,
    ],
  },

  // ----------------------------------------------------------
  // DRIVERS
  // ----------------------------------------------------------
  {
    href: "/drivers",
    label: "Drivers",
    icon: UserRound,
    perm: P.DRIVERS.VIEW,
  },

  // ----------------------------------------------------------
  // STAFF / USERS
  // ----------------------------------------------------------
  {
    href: "/staff",
    label: "Staff / Users",
    icon: ShieldCheck,
    perm: P.EMPLOYEES.VIEW,
  },

  // ----------------------------------------------------------
  // REPORTS
  // ----------------------------------------------------------
  {
    href: "/reports",
    label: "Reports",
    icon: FileBarChart,
    perm: P.REPORTS.VIEW,
  },

  // ----------------------------------------------------------
  // REMINDERS
  // ----------------------------------------------------------
  {
    href: "/reminders",
    label: "Reminders",
    icon: Bell,
    perm: P.REMINDERS.VIEW,
  },

  // ----------------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------------
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,

    anyPerm: [
      P.SETTINGS.VIEW,
      P.SETTINGS.UPDATE,
    ],
  },

  // ----------------------------------------------------------
  // DOCUMENTS
  // ----------------------------------------------------------
  // Backend has entity-specific document permissions.
  // It does NOT define a generic documents.view.
  {
    href: "/documents",
    label: "Documents",
    icon: FileText,

    anyPerm: [
      P.CUSTOMERS.DOCUMENTS_VIEW,
      P.CARS.DOCUMENTS_VIEW,
      P.DRIVERS.DOCUMENTS_VIEW,
    ],
  },

  // ----------------------------------------------------------
  // BACKUP & SECURITY
  // ----------------------------------------------------------
  // No backup permission exists in the backend.
  // Restrict navigation to business admins.
  // {
  //   href: "/backup-security",
  //   label: "Backup & Security",
  //   icon: DatabaseBackup,
  //   adminOnly: true,
  // },
]);

// ============================================================
// NAVIGATION ACCESS
// ============================================================

/**
 * Determine whether a user can see a navigation item.
 *
 * Rules:
 * 1. No user -> hidden
 * 2. adminOnly -> business admin only
 * 3. perm -> requires that permission
 * 4. anyPerm -> requires at least one
 * 5. allPerms -> requires every permission
 * 6. No access rule -> hidden (fail closed)
 */
export const canSeeNavItem = (user, item) => {
  if (!user || !item) {
    return false;
  }

  if (item.adminOnly) {
    return isAdmin(user);
  }

  if (item.perm) {
    return hasPerm(user, item.perm);
  }

  if (Array.isArray(item.anyPerm)) {
    return hasAnyPerm(user, item.anyPerm);
  }

  if (Array.isArray(item.allPerms)) {
    return item.allPerms.length > 0 &&
      item.allPerms.every((permission) =>
        hasPerm(user, permission)
      );
  }

  return false;
};

// ============================================================
// FILTERED NAVIGATION
// ============================================================

export const getVisibleNavItems = (user) => {
  if (!user) return [];

  return NAV_ITEMS.filter((item) =>
    canSeeNavItem(user, item)
  );
};

// ============================================================
// ACTIVE NAVIGATION
// ============================================================

/**
 * Correctly handles:
 *
 * /bookings/new -> New Booking
 * /bookings -> All Bookings
 * /bookings/123 -> All Bookings
 *
 * Other routes use normal prefix matching.
 */
export const isNavItemActive = (pathname, item) => {
  if (
    typeof pathname !== "string" ||
    !item?.href
  ) {
    return false;
  }

  const path =
    pathname.replace(/\/+$/, "") || "/";

  const href =
    item.href.replace(/\/+$/, "") || "/";

  if (href === "/bookings/new") {
    return path === "/bookings/new";
  }

  if (href === "/bookings") {
    return (
      path === "/bookings" ||
      (
        path.startsWith("/bookings/") &&
        !path.startsWith("/bookings/new")
      )
    );
  }

  if (item.exact) {
    return path === href;
  }

  return (
    path === href ||
    path.startsWith(`${href}/`)
  );
};

// ============================================================
// NAVIGATION LOOKUP
// ============================================================

export const getNavItemByHref = (href) => {
  if (typeof href !== "string") {
    return null;
  }

  return (
    NAV_ITEMS.find((item) =>
      item.href === href
    ) || null
  );
};

export const getActiveNavItem = (pathname) => {
  return (
    NAV_ITEMS.find((item) =>
      isNavItemActive(pathname, item)
    ) || null
  );
};
