import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Monitor, Smartphone } from "lucide-react";

import SmartImage from "@/components/common/SmartImage";

// ======================================================
// ASSETS & LINKS
// Change these when you add your final files.
// ======================================================

const LOGO_SRC = "/images/logo.svg";
const BACKGROUND_SRC = "/images/cars/background-image.png";

export const DEMO_VIDEOS_HREF = "/demo-videos";
export const MOBILE_APP_HREF = "/downloads/cars_rent.apk";
export const WINDOWS_APP_HREF = "/downloads/CarsRent-Setup-1.0.0.exe";

// ======================================================
// SHARED FIELD HELPERS (used by login + signup)
//
// They rely on the `.auth-panel` rules in styles/index.css:
// label = 26px tall (20px line + 6px gap), input = 44px tall.
// That is why icons/toggles are positioned at top-[26px] h-11.
// ======================================================

export function AuthField({ icon: Icon, trailing, children }) {
  return (
    <div className="group relative min-w-0">
      {children}

      {Icon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-[26px] grid h-11 w-11 place-items-center text-slate-400 transition-colors group-focus-within:text-primary"
        >
          <Icon size={18} />
        </span>
      )}

      {trailing}
    </div>
  );
}

export function PasswordToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      className="absolute right-0 top-[26px] grid h-11 w-11 place-items-center rounded-xl text-slate-400 transition-colors hover:text-primary focus-visible:text-primary"
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}

// ======================================================
// YOUTUBE ICON (inline SVG, no extra dependency)
// ======================================================

function YouTubeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 20"
      className="h-5 w-7 shrink-0"
      fill="none"
    >
      <rect width="28" height="20" rx="5" fill="#ffffff" />
      <path d="M11.5 5.5v9l7.5-4.5-7.5-4.5Z" fill="#e62117" />
    </svg>
  );
}

// ======================================================
// SHARED ACTION BUTTONS
// ======================================================

export function DemoVideosButton() {
  return (
    <Link
      href={DEMO_VIDEOS_HREF}
      className="btn h-11 w-full bg-[#e62117] text-[15px] text-white shadow-md shadow-red-600/25 hover:bg-[#c91b12] [@media(max-height:720px)]:h-10"
    >
      <YouTubeIcon />
      Demo Videos
    </Link>
  );
}

export function AppDownloadButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <a
        href={MOBILE_APP_HREF}
        download
        className="btn btn-outline h-11 border-primary/40 bg-white/80 [@media(max-height:720px)]:h-10"
      >
        <Smartphone size={16} />
        Mobile App
      </a>

      <a
        href={WINDOWS_APP_HREF}
        download
        className="btn btn-outline h-11 border-primary/40 bg-white/80 [@media(max-height:720px)]:h-10"
      >
        <Monitor size={16} />
        Windows App
      </a>
    </div>
  );
}

/**
 * Wrapper for the buttons at the bottom of the card.
 * sticky = true  -> stays pinned to the bottom of the scrolling card body
 *                   (use it INSIDE the <Form> on long forms like signup).
 */
export function AuthActions({ children, sticky = false }) {
  return (
    <div
      className={
        sticky
          ? "sticky bottom-0 z-10 -mx-5 mt-4 space-y-3 border-t border-[#c3d6f4] bg-[#e4efff]/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6"
          : "space-y-3"
      }
    >
      {children}
    </div>
  );
}

// ======================================================
// LOGIN / SIGN UP TABS
// ======================================================

function AuthTabs({ mode }) {
  const base =
    "inline-flex h-10 min-w-[88px] items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors";
  const active =
    "bg-gradient-to-b from-[#2f84ff] to-primary text-white shadow-md shadow-primary/30";
  const idle = "text-slate-600 hover:text-primary";

  return (
    <nav
      aria-label="Account"
      className="flex w-fit items-center gap-1 rounded-full border border-[#c3d6f4] bg-white/70 p-1 shadow-sm sm:absolute sm:left-1/2 sm:-translate-x-1/2"
    >
      <Link
        href="/login"
        aria-current={mode === "login" ? "page" : undefined}
        className={`${base} ${mode === "login" ? active : idle}`}
      >
        Login
      </Link>

      <Link
        href="/signup"
        aria-current={mode === "signup" ? "page" : undefined}
        className={`${base} ${mode === "signup" ? active : idle}`}
      >
        Sign Up
      </Link>
    </nav>
  );
}

// ======================================================
// SMALL LOGO (top-left of the card)
// The logo sits on a navy chip so it stays readable on the
// light-blue card even if logo.svg has white lettering.
// ======================================================

function CardLogo() {
  return (
    <Link
      href="/login"
      aria-label="Rent a Car Management System"
      className="grid shrink-0 place-items-center rounded-xl bg-sidebar px-2 py-1.5 shadow-sm max-[359px]:hidden"
    >
      <SmartImage
        src={LOGO_SRC}
        alt="Rent a Car Management System"
        width={64}
        height={27}
        priority
      />
    </Link>
  );
}

// ======================================================
// LAYOUT
//
// The background image fills the whole screen. The form
// lives in a light-blue glass card on the right (centred on
// tablet/mobile).
//   - Tabs are fixed at the top of the card.
//   - The card body is the only scroll area, so a short form
//     (login) never scrolls and a long form (signup) does.
//
// Props:
//   mode   "login" | "signup"  (highlights the active tab)
//   footer small text strip pinned to the bottom of the card
// ======================================================

export default function AuthLayout({
  mode = "login",
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-sidebar">
      {/* ================= BACKGROUND ================= */}
      <Image
        src={BACKGROUND_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[72%_center] lg:object-[left_top]"
      />

      {/* Darkens the photo on small screens where the baked-in text is cropped */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-sidebar/60 lg:hidden"
      />

      {/* ================= CONTENT ================= */}
      <div className="mx-auto flex h-dvh w-full max-w-[1920px] flex-col items-center justify-center gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:justify-end lg:px-10 xl:pr-[7vw]">
        <section
          className={[
            "auth-panel flex max-h-full min-h-0 w-full flex-col overflow-hidden",
            "rounded-3xl border border-white/70 bg-[#e4efff]/90 shadow-pop backdrop-blur-xl",
            // light-blue inputs that match the card
            "[&_.input]:border-[#c3d6f4] [&_.input]:bg-[#d9e8fd]",
            "[&_.input:focus]:bg-white",
            "max-w-[460px]",
          ].join(" ")}
        >
          {/* Logo (left) + tabs (centre) */}
          <header className="relative flex shrink-0 items-center justify-between border-b border-[#c3d6f4] bg-white/40 px-5 py-3 sm:justify-start sm:px-6 [@media(max-height:720px)]:py-2.5">
            <CardLogo />
            <AuthTabs mode={mode} />
          </header>

          {/* Scrolling body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 sm:px-6 sm:pt-5 [@media(max-height:720px)]:pt-3">
            <div className="mb-4 text-center [@media(max-height:720px)]:mb-3">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-heading [@media(max-height:720px)]:text-2xl">
                {title}
              </h1>

              {subtitle && (
                <p className="mt-1.5 text-sm font-medium text-primary">
                  {subtitle}
                </p>
              )}
            </div>

            {children}
          </div>

          {footer && (
            <div className="shrink-0 border-t border-[#c3d6f4] bg-white/40 px-5 py-2.5 text-center text-[13px] text-slate-600 sm:px-6">
              {footer}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}