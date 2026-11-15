
"use client";

import { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";

import {
  hasPerm,
  hasAllPerms,
  ALLOWED_PERMISSIONS,
} from "@/constants/permissions";


// ============================================================
// CONFIGURATION
// ============================================================

export const ENABLE_SUPER_ADMIN_UI = true;

export const PLATFORM_ROUTES = Object.freeze({
  DASHBOARD: '/super-admin/dashboard',
  BUSINESSES: '/super-admin/businesses',
  SUBSCRIPTIONS: '/super-admin/subscriptions',
  ADMINS: "/super-admin/admins",
  SETTINGS: "/super-admin/settings",
});

export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: "super-admin",
  ADMIN: "admin",
  EMPLOYEE: "employee",
});

export const DATA_SCOPES = Object.freeze({
  OWN: "own",
  BUSINESS: "business",
});



// ============================================================
// INTERNAL HELPERS
// ============================================================

const ALLOWED_SET = new Set(ALLOWED_PERMISSIONS);

const normalizePermissions = (value) => {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (permission) =>
      typeof permission === "string" &&
      permission.trim()
  );
};

const validEmployeePermission = (permission) =>
  ALLOWED_SET.has(permission);

// ============================================================
// MAIN AUTH HOOK
// ============================================================

export function useAuth() {
  const {
    user = null,
    token = null,
    ready = false,
    expired = false,
  } = useSelector((state) => state.auth || {});

  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  const isAuthenticated = Boolean(
    token &&
    user &&
    !expired &&
    user.status !== "disabled"
  );

  // ----------------------------------------------------------
  // ROLES
  // ----------------------------------------------------------

  const role = user?.role || null;

  const isSuperAdmin =
    isAuthenticated &&
    role === USER_ROLES.SUPER_ADMIN;

  const isAdmin =
    isAuthenticated &&
    role === USER_ROLES.ADMIN;

  const isEmployee =
    isAuthenticated &&
    role === USER_ROLES.EMPLOYEE;

  const isBusinessUser = isAdmin || isEmployee;

  const isPlatformEnabled =
    ENABLE_SUPER_ADMIN_UI && isSuperAdmin;

  // ----------------------------------------------------------
  // BUSINESS CONTEXT
  // ----------------------------------------------------------

  const businessId = isBusinessUser
    ? user?.businessId || null
    : null;

  const dataScope = isAdmin
    ? DATA_SCOPES.BUSINESS
    : isEmployee
      ? user?.dataScope === DATA_SCOPES.BUSINESS
        ? DATA_SCOPES.BUSINESS
        : DATA_SCOPES.OWN
      : null;

  const isOwnScope =
    isEmployee &&
    dataScope === DATA_SCOPES.OWN;

  const isBusinessScope =
    isBusinessUser &&
    dataScope === DATA_SCOPES.BUSINESS;

  // ----------------------------------------------------------
  // EMPLOYEE PERMISSIONS
  // ----------------------------------------------------------

  const permissions = useMemo(() => {
    if (!isEmployee) return [];

    return Array.isArray(user?.permissions)
      ? user.permissions.filter(validEmployeePermission)
      : [];
  }, [isEmployee, user?.permissions]);

  // ----------------------------------------------------------
  // PERMISSION CHECK
  // ----------------------------------------------------------

  /**
   * IMPORTANT:
   *
   * Business Admin:
   * - Full business permission access.
   * - Does not require permissions array.
   * - Supports existing old permission strings
   *   while frontend migration is in progress.
   *
   * Employee:
   * - Only valid backend permissions.
   *
   * Super Admin:
   * - No automatic tenant access.
   */
  const can = useCallback(
    (permission) => {
      if (!isAuthenticated) return false;

      // Business admin bypasses ALL business permission
      // checks, including legacy page permission strings.
      if (isAdmin) return true;

      // Platform role must use platform authorization.
      if (isSuperAdmin) return false;

      if (!isEmployee) return false;

      // An employee must have an explicit permission.
      if (!permission) return false;

      const required = normalizePermissions(permission);

      if (!required.length) return false;

      // Arrays are treated as ANY for compatibility with
      // navigation and existing frontend permission checks.
      return required.some(
        (key) =>
          validEmployeePermission(key) &&
          permissions.includes(key)
      );
    },
    [
      isAuthenticated,
      isAdmin,
      isSuperAdmin,
      isEmployee,
      permissions,
    ]
  );

  // ----------------------------------------------------------
  // ANY PERMISSION
  // ----------------------------------------------------------

  const canAny = useCallback(
    (required = []) => {
      if (!isAuthenticated) return false;

      if (isAdmin) return true;

      if (!isEmployee) return false;

      const list = normalizePermissions(required);

      if (!list.length) return false;

      return list.some(
        (permission) =>
          validEmployeePermission(permission) &&
          permissions.includes(permission)
      );
    },
    [isAuthenticated, isAdmin, isEmployee, permissions]
  );

  // ----------------------------------------------------------
  // ALL PERMISSIONS
  // ----------------------------------------------------------

  const canAll = useCallback(
    (required = []) => {
      if (!isAuthenticated) return false;

      if (isAdmin) return true;

      if (!isEmployee) return false;

      const list = normalizePermissions(required);

      if (!list.length) return false;

      return list.every(
        (permission) =>
          validEmployeePermission(permission) &&
          permissions.includes(permission)
      );
    },
    [isAuthenticated, isAdmin, isEmployee, permissions]
  );

  // ----------------------------------------------------------
  // ADMIN MANAGEMENT
  // ----------------------------------------------------------

  const canManageBusiness = isAdmin;

  // Backend employee management is admin-only.
  const canManageEmployees = isAdmin;

  const canViewEmployees = can("employees.view");

  const canViewSettings = can("settings.view");

  const canUpdateSettings = can("settings.update");

  // ----------------------------------------------------------
  // FUTURE SUPER ADMIN
  // ----------------------------------------------------------

  const canAccessPlatform = useCallback(
    () => isPlatformEnabled,
    [isPlatformEnabled]
  );

  // ----------------------------------------------------------
  // SUBSCRIPTION INFORMATION
  // ----------------------------------------------------------

  // Available only if profile/subscription data is
  // stored in the auth user object.
  const subscription = isBusinessUser
    ? user?.subscription || null
    : null;

  const subscriptionStatus =
    subscription?.status || null;

  const subscriptionPlan =
    subscription?.plan || null;

  const isLifetime =
    subscriptionPlan === "lifetime";

  const isTrial =
    subscriptionPlan === "trial" &&
    subscriptionStatus === "trialing";

  const subscriptionEndDate =
    subscription?.endDate || null;

  const daysRemaining = useMemo(() => {
    if (!subscriptionEndDate || isLifetime) {
      return null;
    }

    const end = new Date(subscriptionEndDate);

    if (Number.isNaN(end.getTime())) {
      return null;
    }

    return Math.max(
      0,
      Math.ceil(
        (end.getTime() - Date.now()) / 86400000
      )
    );
  }, [subscriptionEndDate, isLifetime]);

  // Display-only value. Backend checkSubscription
  // remains the authorization authority.
  const isSubscriptionActive = Boolean(
    subscription &&
    (
      (
        isTrial &&
        daysRemaining !== null &&
        daysRemaining > 0
      ) ||
      (
        ["monthly", "yearly", "lifetime"].includes(
          subscriptionPlan
        ) &&
        subscriptionStatus === "active" &&
        subscription.paymentStatus === "paid" &&
        (
          isLifetime ||
          (
            daysRemaining !== null &&
            daysRemaining > 0
          )
        )
      )
    )
  );

  // ----------------------------------------------------------
  // RETURN
  // ----------------------------------------------------------

  return {
    // Authentication
    user,
    token,
    ready,
    expired,
    isAuthenticated,

    // Roles
    role,
    isSuperAdmin,
    isAdmin,
    isEmployee,
    isBusinessUser,

    // Business
    businessId,
    dataScope,
    isOwnScope,
    isBusinessScope,

    // Permissions
    permissions,
    can,
    canAny,
    canAll,

    // Management
    canManageBusiness,
    canManageEmployees,
    canViewEmployees,
    canViewSettings,
    canUpdateSettings,

    // Platform
    isPlatformEnabled,
    canAccessPlatform,

    // Subscription
    subscription,
    subscriptionStatus,
    subscriptionPlan,
    subscriptionEndDate,
    isTrial,
    isLifetime,
    daysRemaining,
    isSubscriptionActive,
  };
}

// ============================================================
// ADDITIONAL HOOKS
// ============================================================

export function usePermission(permission) {
  return useAuth().can(permission);
}

export function useAnyPermission(permissions) {
  return useAuth().canAny(permissions);
}

export function useAllPermissions(permissions) {
  return useAuth().canAll(permissions);
}

export function useRole(role) {
  const auth = useAuth();

  return auth.isAuthenticated && auth.role === role;
}

export function useBusinessAccess() {
  return useAuth().isBusinessUser;
}

export function usePlatformAccess() {
  return useAuth().canAccessPlatform();
}
