# Rent a Car Management System (Frontend)

Premium, easy-to-use frontend for rent-a-car businesses in Lahore, Pakistan.
**Next.js (App Router) · JavaScript/JSX only · Tailwind CSS v4 · Redux Toolkit + RTK Query · React Hook Form + Zod · Recharts · Sonner · date-fns · Lucide**

## Quick start

```bash
unzip rent-a-car-system.zip
cd rent-a-car-system
npm install
npm run dev          # http://localhost:3000
```
Production: `npm run build && npm start`.

### Demo logins (on the login page you can also tap a button to fill them)

| Role | Email | Password | Notes |
|---|---|---|---|
| Owner / Admin | `admin@rentacar.pk` | `admin123` | Sees everything |
| Employee (Bilal) | `bilal@rentacar.pk` | `employee123` | Only own records, no finance, CNIC masked |
| Employee + finance (Usman) | `usman@rentacar.pk` | `employee123` | Can see Income & Expenses / reports |
| Employee + documents (Hina) | `hina@rentacar.pk` | `employee123` | Can see CNIC / licence |

There is also a **Sign up** page (`/signup`) - new accounts are created in the demo database (browser only).

## Where the fake (demo) data lives - one file per area (`src/mock/`)

| File | Contents |
|---|---|
| `people.mjs` | Pakistani customer / driver / staff names (also used to make avatars) |
| `customers.js` | 30 customers (mobile, CNIC, address, document images) |
| `cars.js` | 12 cars (Corolla x2, Civic, Swift, Fortuner, BR-V, Yaris, Wagon R, Sportage, City, Tucson, Alto), plates, rates, insurance/token dates |
| `drivers.js`, `staff.js`, `settings.js` | Drivers, staff accounts + permissions, business settings |
| `bookings.js` | ~220 bookings + ~770 payments (Cash, JazzCash, Easypaisa, Bank Transfer, Other) over 6 months, overdue / due-today / reserved / cancelled cases, no overlapping bookings |
| `expenses.js` | ~500 expenses (petrol, service, oil, repair, salary, office) |
| `index.js` | Assembles everything (documents, activity, backups, sessions) |

Images are in `public/images/` (customers, drivers, admins, cars, payments, docs, banner, logo). They are SVG files made by `scripts/generate-assets.mjs` (`npm run assets` rebuilds them). Replace them with real photos/logos any time. Payment logos are simple stylised placeholders.

Data is stored in the browser (`localStorage`). Use **Backup & Security → Reset Demo Data** to start again.

## Feature checklist (from the PDF)

1. **Dashboard** - cars, available, on rent, repair, today's bookings, due today, overdue, today's income, pending, car-status donut, activity, income vs expenses chart, latest bookings, overdue cars, reminders. Every card links to a filtered page.
2. **Customers** - list, add/edit/view/delete, photo, CNIC front/back, licence, history, payments, total spent, balance, ledger link, print, new booking.
3. **Cars** - grid + list, add/edit/view, photos, plate, daily/hourly rent, status (Available/Booked/On Rent/Under Repair), documents, insurance/token dates, service history, oil changes, repairs, rental history.
4. **New Booking** - customer, car, dates/times, availability check (no overlaps), driver, employee, charges, advance, deposit (separate), payment method, review + confirm. Edit, cancel, extend.
5. **All Bookings** - tabs (all/upcoming/reserved/active/completed/cancelled/overdue), filters, drawer, detail page, print, issue/return.
6. **Car Issue / Return** - meter, fuel, photos, damage, late/extra-day/extra-km/damage charges, deposit refund or adjustment, printable handover and return forms.
7. **Billing & Payments** - bills, receipts, advance/partial/full, security deposits and refunds (kept separate from income), payment history, duplicate-submit protection.
8. **Customer Ledger (Khata)** - per customer, date range, running balance, print/PDF/Excel.
9. **Income & Expenses** - filters + detailed table + totals, group by day/month/year, add/edit/delete expenses (general expenses are never assigned to a car).
10. **Drivers** and **Staff / Users** with a permission matrix (view/create/edit/delete/print/export + finance + sensitive documents + all records).
11. **Reports** - 14 reports with filters, totals, print / PDF / Excel.
12. **Reminders** - return due, overdue, insurance, token tax, documents, service, oil change (Today / Upcoming / Overdue / Completed).
13. **Settings**, **Documents** (upload/preview/replace/download with validation), **Backup & Security**.
14. Section 14 (online booking, mobile app, GPS, WhatsApp) is intentionally **not** built.

## Architecture

```
src/app            routes (auth) and (dashboard) groups, every page uses the same shell
src/components     layout / common / forms / tables / filters / feedback / modals (all shared)
src/features       module-specific pieces (forms, drawers)
src/redux          store, slices, api/ (one baseApi + one file per module)
src/services       dataService (the ONE data interface) + adapters + mock server
src/lib            dates, money, pricing, print templates, export, file helpers
src/styles/index.css   all design tokens and reusable classes
```

* **UI never touches storage.** Pages → RTK Query hooks → `baseApi` → `dataService`.
* **Demo vs real API:** `.env.local` → `NEXT_PUBLIC_USE_MOCK=true` uses the in-browser mock server (`src/services/server/*`, which also enforces permissions and employee data isolation like a backend should). Set `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_URL=https://your-api/api` to call a real Express API. The URLs/params/bodies the mock handles are the API contract your backend should implement (see `src/redux/api/*.js`).
* **Filters, search, sort, page, page size are kept in the URL** and sent to the server (server-side filtering/pagination). Search is debounced.
* **Offline-ready:** swap `src/services/adapters/localStorageAdapter.js` for an IndexedDB / RxDB adapter with the same methods. The top bar shows the 7 sync states (Online, Offline, Pending Sync, Syncing, Synced, Sync Failed, Conflict) - **simulated** in demo mode.
* **Security note:** frontend permissions only hide things. Your Express backend must enforce authorization and employee isolation itself. Demo passwords are plain text only because it is a mock DB. Do not put secrets in `NEXT_PUBLIC_*` variables.

## Printing and exports

Bills, receipts, booking confirmation, ledger, handover/return forms and report tables are real A4 HTML documents (not screenshots) printed through the browser. **Export PDF** opens the print dialog - choose "Save as PDF". Excel export creates an `.xls` that opens in Excel. CSV is also available (`ExportButtons showCsv`).

## Electron / static export notes

`npm run build:static` creates a static `out/` folder (no Next server needed). Limitations:
* `/bookings/[id]` is pre-rendered only for the placeholder id `view`. For the desktop app, either open booking details in the drawer (already works) or switch that route to `?id=` with `HashRouter`-style navigation.
* Do not add server components that read cookies/headers, route handlers, middleware or `next/image` optimisation (already disabled).
* `window.print()` printing works in Electron; `Save as PDF` can be replaced by `webContents.printToPDF`.

## Known limits (demo)

* `localStorage` is about 5 MB. Uploaded images are shrunk automatically; very many uploads can fill it (a warning is shown in the console and changes stay in memory only).
* Backup: "Download Backup File" really saves a JSON file; there is **no** automatic backup, and the page says so.
* Real payment gateways are not integrated (manual entry only, as required).
