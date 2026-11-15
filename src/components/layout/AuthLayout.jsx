import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

import SmartImage from "@/components/common/SmartImage";

// ======================================================
// ASSETS
// Replace LOGO_SRC later with your final logo file.
// Put the hero photo at: public/images/auth-hero.webp
// ======================================================

const LOGO_SRC = "/images/logo.svg";
const HERO_SRC = "/images/cars/car-logo.png";

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
// LAYOUT
//
// Desktop (>= 1024px): exactly 100dvh, two equal columns.
//   - left  : photo, never scrolls
//   - right : the ONLY scroll container (overflow-y-auto)
// Below 1024px: single column, natural page scrolling,
//   compact navy brand header instead of the hero.
// ======================================================

export default function AuthLayout({
  eyebrow = "Rental business workspace",
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-white lg:h-dvh lg:grid-cols-2 lg:grid-rows-1 lg:overflow-hidden">
      {/* ================= LEFT: HERO PHOTO ================= */}
      <aside className="relative hidden min-h-0 overflow-hidden bg-sidebar lg:block">
        <Image
          src={HERO_SRC}
          alt="A fleet of black executive sedans and SUVs parked in front of a modern marble building"
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-center"
        />

        {/* Navy gradient: protects the logo (top) and the copy (bottom) */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,23,47,.78) 0%, rgba(6,23,47,.30) 32%, rgba(6,23,47,.55) 58%, rgba(6,23,47,.96) 100%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <SmartImage
            src={LOGO_SRC}
            alt="Rent a Car Management System"
            width={200}
            height={84}
            priority
          />

          <div>
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
              <span className="h-2 w-2 rounded-full bg-primary ring-4 ring-primary/30" />
              Built for rental businesses
            </p>

            <h2 className="max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight xl:text-5xl 2xl:text-6xl [@media(max-height:760px)]:text-4xl">
              Manage every rental.
              <span className="block text-[#6ea8ff]">
                Grow your business.
              </span>
            </h2>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-200 xl:text-lg xl:leading-8">
              Cars, bookings, customers, payments, and reports — everything
              your rental business needs in one powerful workspace.
            </p>
          </div>
        </div>
      </aside>

      {/* ================= RIGHT: FORM WORKSPACE =================
          The only scrolling element on desktop. */}
      <div className="auth-panel min-h-0 min-w-0 scroll-smooth bg-white lg:h-dvh lg:overflow-y-auto lg:overscroll-contain">
        <div className="flex min-h-full flex-col">
          {/* Compact brand header (mobile + tablet) */}
          <header className="flex items-center justify-center bg-sidebar px-5 py-4 sm:px-10 lg:hidden">
            <SmartImage
              src={LOGO_SRC}
              alt="Rent a Car Management System"
              width={160}
              height={68}
              priority
            />
          </header>

          {/* Top-right switch link (desktop) */}
          {footer && (
            <div className="hidden justify-end px-12 pt-8 text-sm text-muted lg:flex xl:px-16">
              <p>{footer}</p>
            </div>
          )}

          <main className="flex flex-1 flex-col px-5 py-8 sm:px-10 lg:px-12 lg:py-10 xl:px-16">
            <div className="mx-auto my-auto w-full min-w-0 max-w-3xl">
              <div className="mb-8">
                <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {eyebrow}
                </p>

                <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-heading sm:text-5xl">
                  {title}
                  <span className="text-primary">.</span>
                </h1>

                {subtitle && (
                  <p className="mt-3 text-base leading-7 text-muted sm:text-lg">
                    {subtitle}
                  </p>
                )}
              </div>

              {children}

              {/* Switch link (mobile + tablet) */}
              {footer && (
                <p className="mt-8 text-center text-sm text-muted lg:hidden">
                  {footer}
                </p>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}