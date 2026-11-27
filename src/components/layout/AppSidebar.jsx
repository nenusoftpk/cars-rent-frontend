
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
  MessageCircle,
  Headset,
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


// ============================================================
// ANIMATED HELP & SUPPORT SIDEBAR FOOTER
// ============================================================


function SidebarFooter({
  collapsed = false,
}) {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(
    /\D/g,
    ""
  );

  if (!phone) return null;

  const whatsappHref = `https://wa.me/${phone}?text=${encodeURIComponent(
    "Hello! I need help with the Rent a Car Management System."
  )}`;

  return (
    <div className="border-t border-white/10 p-3">
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Help and Support on WhatsApp"
        title={collapsed ? "Help & Support" : undefined}
        className={cn(
          "group relative flex items-center overflow-hidden",
          "rounded-xl border border-blue-400/20",
          "bg-gradient-to-r from-[#123c75] to-[#0b254a]",
          "shadow-lg shadow-black/20",
          "transition-all duration-300",
          "hover:-translate-y-0.5",
          "hover:border-blue-300/50",
          "hover:shadow-blue-500/20",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-blue-400",
          collapsed
            ? "justify-center p-3"
            : "justify-between gap-3 px-3 py-3"
        )}
      >
        {/* Animated background glow */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-blue-400/10 blur-2xl transition-all duration-500 group-hover:bg-blue-400/30"
        />

        {/* Support text */}
        {!collapsed && (
          <span className="relative z-10 text-sm font-semibold tracking-wide text-white transition-colors duration-300 group-hover:text-blue-200">
            Help & Support
          </span>
        )}

        {/* WhatsApp icon */}
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          {/* Outer pulse rings */}
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/25"
          />

          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[#25D366]/15 transition-transform duration-300 group-hover:scale-125"
          />

          {/* Original WhatsApp icon */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="relative z-10 h-7 w-7 text-[#25D366] drop-shadow-[0_0_7px_rgba(37,211,102,0.45)] transition-all duration-300 group-hover:scale-110 group-hover:text-[#4cff91]"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.347-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </span>
      </a>
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
