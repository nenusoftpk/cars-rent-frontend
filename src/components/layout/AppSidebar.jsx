
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
} from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  useDispatch,
  useSelector,
} from "react-redux";

import {
  X,
  ShieldCheck,
  ShieldAlert,
  LockKeyhole,
  Building2,
  CreditCard,
  Users,
  Settings,
} from "lucide-react";

import {
  NAV_ITEMS,
  canSeeNavItem,
} from "@/constants/navigation";

import {
  useAuth,
  ENABLE_SUPER_ADMIN_UI,
  PLATFORM_ROUTES,
} from "@/hooks/useAuth";

import { setMobileNav } from "@/redux/slices/uiSlice";

import SmartImage from "@/components/common/SmartImage";

import { cn } from "@/lib/utils";

// ============================================================
// FUTURE SUPER ADMIN NAVIGATION
// ============================================================

// Reserved for future platform implementation.
// Do not display until platform UI is enabled.
const SUPER_ADMIN_NAV_ITEMS = Object.freeze([
  {
    href: PLATFORM_ROUTES.DASHBOARD,
    label: "Platform Dashboard",
    icon: ShieldCheck,
    exact: true,
  },
  {
    href: PLATFORM_ROUTES.BUSINESSES,
    label: "Businesses",
    icon: Building2,
  },
  {
    href: PLATFORM_ROUTES.SUBSCRIPTIONS,
    label: "Subscriptions",
    icon: CreditCard,
  },
  {
    href: PLATFORM_ROUTES.ADMINS,
    label: "Admins",
    icon: Users,
  },
  {
    href: PLATFORM_ROUTES.SETTINGS,   // ← add this block
    label: "Settings",
    icon: Settings,
  },
]);

// ============================================================
// ACTIVE ROUTE CHECK
// ============================================================

function isActiveRoute(pathname, item) {
  if (!pathname || !item?.href) return false;

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
}

// ============================================================
// ROLE LABEL
// ============================================================

function getRoleLabel(role) {
  switch (role) {
    case "super-admin":
      return "Super Admin";

    case "admin":
      return "Business Admin";

    case "employee":
      return "Employee";

    default:
      return "Account";
  }
}

// ============================================================
// SIDEBAR BRAND
// ============================================================

function SidebarBrand({
  collapsed = false,
  href = "/dashboard",
  onNavigate,
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label="Rent a Car Dashboard"
      className={cn(
        "flex items-center justify-center",
        "px-3 pt-5 pb-3",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-white"
      )}
    >
      <SmartImage
        src="/images/logo.svg"
        alt="Rent a Car Management System"
        width={200}
        height={84}
        priority
        className={cn(
          "h-auto",
          collapsed ? "w-12" : "w-44"
        )}
      />
    </Link>
  );
}

// ============================================================
// NAVIGATION ITEM
// ============================================================

function SidebarNavItem({
  item,
  pathname,
  collapsed = false,
  onNavigate,
}) {
  const active = isActiveRoute(pathname, item);

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center",
        "gap-3 rounded-xl px-3 h-11",
        "text-[15px] font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-white/80",
        active
          ? "bg-gradient-to-r from-primary to-blue-700 text-white shadow-lg shadow-primary/30"
          : "text-slate-200 hover:bg-white/10",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon
        size={20}
        aria-hidden="true"
        className="shrink-0"
      />

      {!collapsed && (
        <span className="truncate">
          {item.label}
        </span>
      )}

      {collapsed && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute",
            "left-full ml-3 z-50",
            "whitespace-nowrap",
            "rounded-lg bg-heading",
            "px-2.5 py-1.5",
            "text-xs text-white",
            "opacity-0",
            "group-hover:opacity-100",
            "group-focus-visible:opacity-100",
            "shadow-pop"
          )}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

// ============================================================
// SUPER ADMIN DISABLED NOTICE
// ============================================================

function PlatformDisabledNotice({
  collapsed = false,
}) {
  return (
    <div
      role="status"
      className={cn(
        "mx-2 mt-4 rounded-xl",
        "border border-white/10",
        "bg-white/5 text-slate-200",
        collapsed
          ? "flex justify-center p-3"
          : "p-4"
      )}
    >
      {collapsed ? (
        <LockKeyhole
          size={20}
          aria-label="Platform interface unavailable"
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <LockKeyhole size={18} />

            <span className="text-sm font-semibold">
              Platform Interface
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-300">
            Your super-admin account is recognized.
            The platform dashboard is not enabled yet.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NAVIGATION LIST
// ============================================================

function NavList({
  collapsed = false,
  onNavigate,
}) {
  const pathname = usePathname();

  const {
    user,
    ready,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isPlatformEnabled,
    role,
  } = useAuth();

  // ----------------------------------------------------------
  // FILTER NAVIGATION BY ROLE
  // ----------------------------------------------------------

  const visibleItems = useMemo(() => {
    if (!ready || !isAuthenticated || !user) {
      return [];
    }

    // SUPER ADMIN:
    // Never show business navigation.
    if (isSuperAdmin) {
      return isPlatformEnabled && ENABLE_SUPER_ADMIN_UI
        ? SUPER_ADMIN_NAV_ITEMS
        : [];
    }

    // BUSINESS ADMIN:
    // Full access to every business sidebar page.
    // No individual permissions required.
    if (isAdmin) {
      return NAV_ITEMS;
    }

    // EMPLOYEE:
    // Only pages allowed by assigned permissions.
    return NAV_ITEMS.filter((item) =>
      canSeeNavItem(user, item)
    );
  }, [
    ready,
    isAuthenticated,
    user,
    isAdmin,
    isSuperAdmin,
    isPlatformEnabled,
  ]);

  // ----------------------------------------------------------
  // LOADING STATE
  // ----------------------------------------------------------

  if (!ready) {
    return (
      <div
        className="flex-1 space-y-2 px-3 py-3"
        aria-label="Loading navigation"
        aria-busy="true"
      >
        {Array.from(
          { length: 6 },
          (_, index) => (
            <div
              key={index}
              className="h-11 animate-pulse rounded-xl bg-white/10"
            />
          )
        )}
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // ----------------------------------------------------------
  // SUPER ADMIN - CURRENTLY INACTIVE
  // ----------------------------------------------------------

  if (
    isSuperAdmin &&
    !isPlatformEnabled
  ) {
    return (
      <PlatformDisabledNotice
        collapsed={collapsed}
      />
    );
  }

  // ----------------------------------------------------------
  // NO ACCESSIBLE PAGES
  // ----------------------------------------------------------

  if (!visibleItems.length) {
    return (
      <div
        role="status"
        className={cn(
          "mx-2 mt-4 rounded-xl",
          "border border-white/10",
          "bg-white/5 p-3",
          "text-slate-300"
        )}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert
            size={18}
            className="shrink-0"
          />

          {!collapsed && (
            <p className="text-xs">
              No accessible pages. Please contact
              your administrator.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // RENDER NAVIGATION
  // ----------------------------------------------------------

  return (
    <nav
      aria-label={`${getRoleLabel(role)} navigation`}
      className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
    >
      {visibleItems.map((item) => (
        <SidebarNavItem
          key={item.href}
          item={item}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

// ============================================================
// SIDEBAR FOOTER
// ============================================================

function SidebarFooter({
  collapsed = false,
}) {
  const {
    isAuthenticated,
    user,
    role,
    isSuperAdmin,
  } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <div className="border-t border-white/10 px-3 py-3">
      <div
        className={cn(
          "flex items-center",
          "rounded-xl bg-white/5",
          "text-slate-200",
          collapsed
            ? "justify-center p-3"
            : "gap-3 p-3"
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0",
            "items-center justify-center",
            "rounded-lg bg-white/10"
          )}
        >
          <ShieldCheck
            size={18}
            aria-hidden="true"
          />
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user?.name || getRoleLabel(role)}
            </p>

            <p className="truncate text-xs text-slate-400">
              {getRoleLabel(role)}

              {isSuperAdmin &&
                !ENABLE_SUPER_ADMIN_UI
                ? " - UI Pending"
                : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN SIDEBAR
// ============================================================

export default function AppSidebar() {
  const dispatch = useDispatch();

  const {
    collapsed = false,
    mobileNav = false,
  } = useSelector((state) => state.ui || {});

  const {
    isSuperAdmin,
    isPlatformEnabled,
  } = useAuth();

  const pathname = usePathname();

  // ----------------------------------------------------------
  // CLOSE MOBILE MENU
  // ----------------------------------------------------------

  const closeMobileNav = useCallback(() => {
    dispatch(setMobileNav(false));
  }, [dispatch]);

  // Close mobile drawer when route changes.
  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  // Close mobile drawer with Escape.
  useEffect(() => {
    if (!mobileNav) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMobileNav();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [mobileNav, closeMobileNav]);

  // ----------------------------------------------------------
  // HOME ROUTE
  // ----------------------------------------------------------

  const homeHref =
    isSuperAdmin && isPlatformEnabled
      ? PLATFORM_ROUTES.DASHBOARD
      : "/dashboard";

  const platformDisabled =
    isSuperAdmin && !isPlatformEnabled;

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  return (
    <>
      {/* ================================================
          DESKTOP SIDEBAR
      ================================================= */}

      <aside
        aria-label="Desktop sidebar"
        className={cn(
          "hidden lg:flex",
          "fixed inset-y-0 left-0 z-40",
          "flex-col",
          "bg-gradient-to-b",
          "from-sidebar to-[#081c3a]",
          "transition-[width] duration-200"
        )}
        style={{
          width: collapsed
            ? "var(--sidebar-w-collapsed)"
            : "var(--sidebar-w)",
        }}
      >
        {platformDisabled ? (
          <div className="px-3 pt-5 pb-3">
            <SmartImage
              src="/images/logo.svg"
              alt="Rent a Car Management System"
              width={200}
              height={84}
              priority
              className={cn(
                "mx-auto h-auto",
                collapsed ? "w-12" : "w-44"
              )}
            />
          </div>
        ) : (
          <SidebarBrand
            collapsed={collapsed}
            href={homeHref}
          />
        )}

        <NavList collapsed={collapsed} />

        <SidebarFooter collapsed={collapsed} />
      </aside>

      {/* ================================================
          MOBILE SIDEBAR
      ================================================= */}

      {mobileNav && (
        <div
          className={cn(
            "lg:hidden",
            "fixed inset-0 z-[55]",
            "anim-fade"
          )}
        >
          {/* Backdrop */}

          <button
            type="button"
            onClick={closeMobileNav}
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/50"
          />

          {/* Drawer */}

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
            className={cn(
              "absolute inset-y-0 left-0",
              "w-[270px]",
              "flex flex-col",
              "bg-gradient-to-b",
              "from-sidebar to-[#081c3a]",
              "anim-drawer"
            )}
          >
            {/* Header */}

            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              {platformDisabled ? (
                <SmartImage
                  src="/images/logo.svg"
                  alt="Rent a Car"
                  width={160}
                  height={66}
                  className="w-36 h-auto"
                />
              ) : (
                <SidebarBrand
                  href={homeHref}
                  onNavigate={closeMobileNav}
                />
              )}

              <button
                type="button"
                onClick={closeMobileNav}
                aria-label="Close menu"
                className={cn(
                  "rounded-lg p-2",
                  "text-white",
                  "hover:bg-white/10",
                  "focus-visible:outline-none",
                  "focus-visible:ring-2",
                  "focus-visible:ring-white"
                )}
              >
                <X
                  size={22}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Navigation */}

            <NavList
              collapsed={false}
              onNavigate={closeMobileNav}
            />

            {/* Footer */}

            <SidebarFooter collapsed={false} />
          </aside>
        </div>
      )}
    </>
  );
}
