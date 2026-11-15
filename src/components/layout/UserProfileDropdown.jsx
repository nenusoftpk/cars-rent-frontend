
"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { toast } from "sonner";

import {
  ChevronDown,
  LogOut,
  Settings,
  UserRound,
  ShieldCheck,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";

import {
  useLogoutUserMutation,
} from "@/redux/api/authApi";

import { logout } from "@/redux/slices/authSlice";
import { baseApi } from "@/redux/api/baseApi";
import { Avatar } from "@/components/common/SmartImage";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function getRoleLabel(role) {
  switch (role) {
    case "super-admin":
      return "Super Admin";

    case "admin":
      return "Business Owner";

    case "employee":
      return "Employee";

    default:
      return "User";
  }
}

// --------------------------------------------------
// MENU ITEM
// --------------------------------------------------

function MenuLink({
  href,
  icon: Icon,
  children,
  onClick,
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-heading transition-colors hover:bg-soft focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Icon
        size={17}
        className="shrink-0 text-muted"
      />

      <span>{children}</span>
    </Link>
  );
}

// --------------------------------------------------
// USER PROFILE DROPDOWN
// --------------------------------------------------

export default function UserProfileDropdown() {
  const { user } = useAuth();

  const router = useRouter();
  const dispatch = useDispatch();

  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  const [open, setOpen] = useState(false);

  const [
    logoutUser,
    { isLoading: isLoggingOut },
  ] = useLogoutUserMutation();

  // ------------------------------------------------
  // CLOSE ON OUTSIDE CLICK / ESCAPE
  // ------------------------------------------------

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  // ------------------------------------------------
  // CLEAR SESSION
  // ------------------------------------------------

  const clearSession = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("rac_auth");
    }

    dispatch(logout());

    dispatch(
      baseApi.util.resetApiState()
    );
  };

  // ------------------------------------------------
  // LOGOUT
  // ------------------------------------------------

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setOpen(false);

    try {
      // Call backend first so the server can revoke
      // the token before frontend credentials vanish.
      await logoutUser().unwrap();

      clearSession();

      toast.success(
        "You have logged out successfully."
      );

      router.replace("/login");
    } catch (error) {
      console.error(
        "Backend logout failed:",
        error
      );

      // Keep credentials on a failed logout request,
      // rather than falsely claiming server revocation.
      toast.error(
        "Unable to log out. Please try again."
      );
    }
  };

  // ------------------------------------------------
  // AUTH STATE
  // ------------------------------------------------

  if (!user) {
    return null;
  }

  const fullName =
    typeof user.name === "string" &&
    user.name.trim()
      ? user.name.trim()
      : "User";

  const firstName =
    fullName.split(/\s+/)[0];

  const email =
    user.email || "";

  const roleLabel =
    getRoleLabel(user.role);

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  return (
    <div
      ref={dropdownRef}
      className="relative"
    >
      {/* PROFILE TRIGGER */}

      <button
        ref={triggerRef}
        type="button"
        onClick={() =>
          setOpen((previous) => !previous)
        }
        disabled={isLoggingOut}
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-lg border-l border-white/15 pl-3 text-left transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Avatar
          src={user.photo}
          name={fullName}
          size={38}
          className="ring-2 ring-white/30"
        />

        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-32 truncate text-sm font-semibold text-white">
            {firstName}
          </span>

          <span className="block max-w-32 truncate text-xs text-slate-300">
            {roleLabel}
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-300 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* DROPDOWN */}

      {open && (
        <div
          role="menu"
          aria-label="Account options"
          className="anim-pop card shadow-pop absolute right-0 z-50 mt-3 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-line bg-white p-1 text-heading"
        >
          {/* USER HEADER */}

          <div className="flex items-center gap-3 border-b border-line px-3 py-3">
            <Avatar
              src={user.photo}
              name={fullName}
              size={42}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-heading">
                {fullName}
              </p>

              <p className="mt-0.5 truncate text-xs text-muted">
                {email}
              </p>

              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <ShieldCheck size={12} />
                {roleLabel}
              </span>
            </div>
          </div>

          {/* NAVIGATION */}

          <div className="py-1">
            <MenuLink
              href="/settings?tab=profile"
              icon={UserRound}
              onClick={() => setOpen(false)}
            >
              My Profile
            </MenuLink>

            <MenuLink
              href="/settings?tab=password"
              icon={ShieldCheck}
              onClick={() => setOpen(false)}
            >
              Account Security
            </MenuLink>

            <MenuLink
              href="/settings"
              icon={Settings}
              onClick={() => setOpen(false)}
            >
              Settings
            </MenuLink>
          </div>

          {/* LOGOUT */}

          <div className="border-t border-line pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-danger transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <LogOut size={17} />
              )}

              <span>
                {isLoggingOut
                  ? "Logging out..."
                  : "Logout"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
