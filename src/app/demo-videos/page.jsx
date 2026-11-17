// src/app/demo-videos/page.jsx
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Search,
  ListVideo,
  Clock,
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  X,
} from "lucide-react";

// ============================================================
// VIDEOS DATA – add / edit / remove items here only
// ============================================================
//
// Each item:
//   id          unique string
//   title       short title
//   description short description
//   youtubeId   YouTube video ID only (the part after v=)
//   duration    "mm:ss" or "h:mm:ss" (display only)
//   category    must match one of CATEGORIES below
//   tags        optional string[] for search
//
const VIDEOS = [
  {
    id: "1",
    title: "Create a New Booking (Full Walkthrough)",
    description:
      "Select customer, pick a car, set dates, add driver charges and confirm a booking end-to-end.",
    youtubeId: "dQw4w9WgXcQ", // replace with your real ID
    duration: "8:42",
    category: "Bookings",
    tags: ["booking", "new booking", "create"],
  },
  {
    id: "2",
    title: "Car Issue & Return with Inspection",
    description:
      "How to issue a car to a customer and complete the return inspection with photos and charges.",
    youtubeId: "jNQXAC9IVRw",
    duration: "6:15",
    category: "Car Issue / Return",
    tags: ["inspection", "issue", "return"],
  },
  {
    id: "3",
    title: "Add Cars & Manage Fleet Pricing",
    description:
      "Add a new vehicle, set daily/hourly rates, upload documents and control availability status.",
    youtubeId: "9bZkp7q19f0",
    duration: "5:30",
    category: "Cars",
    tags: ["cars", "fleet", "pricing"],
  },
  {
    id: "4",
    title: "Customer Ledger (Khata) Explained",
    description:
      "View customer balances, record payments and print statements from the Customer Ledger.",
    youtubeId: "kJQP7kiw5Fk",
    duration: "4:50",
    category: "Billing",
    tags: ["ledger", "khata", "balance"],
  },
  {
    id: "5",
    title: "Receive Advance & Security Deposit",
    description:
      "Record advance payment and security deposit with payment method and screenshot proof.",
    youtubeId: "3JZ_D3ELwOQ",
    duration: "3:55",
    category: "Billing",
    tags: ["payment", "advance", "deposit"],
  },
  {
    id: "6",
    title: "Staff Permissions & Roles",
    description:
      "Create employees, assign permissions and control what each staff member can see and do.",
    youtubeId: "fJ9rUzIMcZQ",
    duration: "7:10",
    category: "Staff",
    tags: ["staff", "permissions", "roles"],
  },
  {
    id: "7",
    title: "Reports Overview – Profit & Utilization",
    description:
      "Generate booking, income, expense and car utilization reports and export them.",
    youtubeId: "LXb3EKWsInQ",
    duration: "5:05",
    category: "Reports",
    tags: ["reports", "export", "profit"],
  },
  {
    id: "8",
    title: "Quick Start – First 10 Minutes Setup",
    description:
      "Recommended first steps after signup: business settings, first car, first customer, first booking.",
    youtubeId: "RgKAFK5djSk",
    duration: "9:20",
    category: "Getting Started",
    tags: ["setup", "onboarding", "quick start"],
  },
];

const CATEGORIES = [
  "All",
  "Getting Started",
  "Bookings",
  "Cars",
  "Car Issue / Return",
  "Billing",
  "Staff",
  "Reports",
];

// ============================================================
// HELPERS
// ============================================================

function youtubeThumb(id, quality = "hqdefault") {
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
}

function youtubeEmbed(id) {
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

function youtubeWatch(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

// ============================================================
// PAGE
// ============================================================

export default function DemoVideosPage() {
  const [activeId, setActiveId] = useState(VIDEOS[0]?.id ?? null);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [showPlaylistMobile, setShowPlaylistMobile] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return VIDEOS.filter((v) => {
      const catOk = category === "All" || v.category === category;
      if (!catOk) return false;
      if (!q) return true;

      const hay = [
        v.title,
        v.description,
        v.category,
        ...(v.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [category, query]);

  const active =
    filtered.find((v) => v.id === activeId) ||
    filtered[0] ||
    VIDEOS[0] ||
    null;

  // Keep selection valid when filters change
  useEffect(() => {
    if (!active) return;
    if (!filtered.some((v) => v.id === active.id) && filtered[0]) {
      setActiveId(filtered[0].id);
    }
  }, [filtered, active]);

  const selectVideo = useCallback((id) => {
    setActiveId(id);
    setShowPlaylistMobile(false);
  }, []);

  const categoryCounts = useMemo(() => {
    const map = { All: VIDEOS.length };
    for (const c of CATEGORIES) {
      if (c === "All") continue;
      map[c] = VIDEOS.filter((v) => v.category === c).length;
    }
    return map;
  }, []);

  return (
    <div className="min-h-dvh bg-[var(--color-page)] text-[var(--color-heading)]">
      {/* ---------- TOP BAR ---------- */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-soft)] hover:text-[var(--color-primary)]"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back to Login</span>
            </Link>

            <div className="hidden h-5 w-px bg-[var(--color-line)] sm:block" />

            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-[#e62117] text-white shadow-sm">
                <Play size={14} fill="currentColor" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight">Demo Videos</p>
                <p className="hidden text-[11px] text-[var(--color-muted)] sm:block">
                  Rent-a-Car Management System
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPlaylistMobile(true)}
              className="btn btn-neutral btn-sm lg:hidden"
            >
              <ListVideo size={15} />
              Playlist
            </button>

            <Link href="/signup" className="btn btn-primary btn-sm">
              Create account
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- MAIN ---------- */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">

        {/* Search + category chips */}
        <div className="mb-5 space-y-3">
          <div className="relative max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos (booking, payment, cars…)"
              className="input h-11 w-full rounded-xl border-[var(--color-line)] bg-white pl-10 pr-10 text-sm shadow-sm"
              aria-label="Search demo videos"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-heading)]"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
            role="tablist"
            aria-label="Video categories"
          >
            {CATEGORIES.map((c) => {
              const activeCat = category === c;
              const count = categoryCounts[c] ?? 0;
              return (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={activeCat}
                  onClick={() => setCategory(c)}
                  className={[
                    "chip shrink-0 transition",
                    activeCat
                      ? "chip-active shadow-sm"
                      : "hover:border-[var(--color-primary)]/40",
                  ].join(" ")}
                >
                  {c}
                  <span
                    className={[
                      "rounded-full px-1.5 text-[10px] font-bold",
                      activeCat ? "bg-white/25" : "bg-[var(--color-soft)]",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Player + playlist */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ===== PLAYER COLUMN ===== */}
          <section className="min-w-0 space-y-4">
            {active ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-black shadow-[var(--shadow-card)]">
                  <div className="relative aspect-video w-full">
                    <iframe
                      key={active.youtubeId}
                      src={youtubeEmbed(active.youtubeId)}
                      title={active.title}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="badge badge-info mb-2">
                        {active.category}
                      </span>
                      <h2 className="text-lg font-extrabold leading-snug tracking-tight sm:text-xl">
                        {active.title}
                      </h2>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--color-muted)]">
                        {active.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)]">
                        <Clock size={13} />
                        {active.duration}
                      </span>
                      <a
                        href={youtubeWatch(active.youtubeId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        Open on YouTube
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-line)] bg-white text-center">
                <LayoutGrid size={36} className="mb-3 text-[var(--color-muted)]" />
                <p className="font-semibold">No videos match your filters</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Try another category or clear the search.
                </p>
                <button
                  type="button"
                  className="btn btn-neutral btn-sm mt-4"
                  onClick={() => {
                    setCategory("All");
                    setQuery("");
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </section>

          {/* ===== PLAYLIST (desktop) ===== */}
          <aside className="hidden lg:block">
            <PlaylistPanel
              videos={filtered}
              activeId={active?.id}
              onSelect={selectVideo}
              totalAll={VIDEOS.length}
            />
          </aside>
        </div>
      </main>

      {/* Mobile playlist drawer */}
      {showPlaylistMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Close playlist"
            onClick={() => setShowPlaylistMobile(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[82dvh] overflow-hidden rounded-t-3xl bg-white shadow-2xl anim-pop">
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <p className="font-bold">Playlist</p>
              <button
                type="button"
                className="rounded-xl p-2 text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
                onClick={() => setShowPlaylistMobile(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(82dvh-52px)] overflow-y-auto overscroll-contain p-3">
              <PlaylistPanel
                videos={filtered}
                activeId={active?.id}
                onSelect={selectVideo}
                totalAll={VIDEOS.length}
                compact
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--color-line)] bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center text-sm text-[var(--color-muted)] sm:flex-row sm:text-left sm:px-6">
          <p>
            Need an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[var(--color-primary)] hover:underline"
            >
              Start free trial
            </Link>
          </p>
          <p className="text-xs">
            © {new Date().getFullYear()} Rent-a-Car Management System
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// PLAYLIST PANEL
// ============================================================

function PlaylistPanel({ videos, activeId, onSelect, totalAll, compact = false }) {
  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-card)]",
        compact ? "" : "sticky top-[4.5rem]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-soft)]/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListVideo size={16} className="text-[var(--color-primary)]" />
          <span className="text-sm font-bold">Playlist</span>
        </div>
        <span className="text-xs font-medium text-[var(--color-muted)]">
          {videos.length}
          {videos.length !== totalAll ? ` of ${totalAll}` : ""} videos
        </span>
      </div>

      <ul className="max-h-[min(70vh,560px)] divide-y divide-[var(--color-line)] overflow-y-auto overscroll-contain">
        {videos.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
            No videos in this filter.
          </li>
        ) : (
          videos.map((v, index) => {
            const isActive = v.id === activeId;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className={[
                    "group flex w-full gap-3 px-3 py-3 text-left transition",
                    isActive
                      ? "bg-[var(--color-primary)]/[0.07]"
                      : "hover:bg-[var(--color-soft)]",
                  ].join(" ")}
                >
                  {/* Index / playing indicator */}
                  <div className="flex w-5 shrink-0 flex-col items-center pt-0.5">
                    {isActive ? (
                      <span className="grid size-5 place-items-center rounded-full bg-[#e62117] text-white">
                        <Play size={10} fill="currentColor" />
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-[var(--color-muted)] group-hover:text-[var(--color-heading)]">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={youtubeThumb(v.youtubeId)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-px text-[10px] font-semibold text-white">
                      {v.duration}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        "line-clamp-2 text-[13px] font-semibold leading-snug",
                        isActive
                          ? "text-[var(--color-primary)]"
                          : "text-[var(--color-heading)]",
                      ].join(" ")}
                    >
                      {v.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                      <span className="truncate">{v.category}</span>
                      {isActive && (
                        <>
                          <ChevronRight size={10} className="shrink-0 opacity-60" />
                          <span className="font-semibold text-[#e62117]">
                            Playing
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}