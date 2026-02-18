# Retail/Service App Expansion — Implementation Plan

This document tracks the phased implementation of the comprehensive modification and feature expansion. All changes match existing patterns and do not break current functionality.

**Email/Contact:** Formspree (contact form on Landing; Help page → admin@stratumpr.com)

**Existing:** Services, Clients (customer list), Appointments/Booking, Inventory, Notifications (table + hook), tax_settings, receipt_settings.

---

## Phase 1 — Database migrations ✅ (Scripts provided)

- **transactions** table: id, business_id, customer_id (nullable, → clients.id), appointment_id (nullable), staff_id (→ profiles.id), created_at, status, payment_method, payment_method_secondary (nullable), subtotal/discount_amount/discount_label, tax_snapshot (JSONB), tip_amount, total, amount_tendered, change_given, notes. All monetary columns in **cents** (bigint).
- **transaction_line_items**: id, transaction_id, type (product/service), reference_id, name, quantity, unit_price, line_total (cents).
- **transaction_refunds**: id, transaction_id, amount, reason, created_at, staff_id, restock_applied (bool).
- **appointments**: add `transaction_id` (nullable), `billed` (boolean default false).
- **tax_settings**: add `region` (text, nullable) for Puerto Rico / US / International presets.

---

## Phase 2 — Inventory (Section 1)

- **Folders removed** from inventory: no folder sidebar, no folder_id in UI, no add/update/delete folder. Products list is flat (filter by search and stock only).
- Default view: **list** (already `viewMode === 'list'`).
- Validation: block negative stock; duplicate SKU warn before save (already present); required name, SKU, price, stock quantity (inline errors).
- Stock indicator: green = at/above threshold, red = below (use default + per-product reorder_level); low-stock notification on threshold (Section 4).
- Product detail: **popup** on row click (not new page); image, name, SKU, barcode (display + generate if missing), description, current stock (color), order history. Closable via X and outside click. Precursor to edit.

---

## Phase 3 — Transactions (Section 2)

- Add **Transactions** to main nav (AppSidebar).
- List: newest first; columns: Transaction ID (e.g. TXN-00123), date/time, customer, staff, line summary, subtotal/taxes/tip/discount/total, payment status, payment method. Row click → detail.
- Filters: date range, staff, customer, payment status, payment method. Search: transaction ID, customer name.
- Create flows: (A) Manual by staff (customer/walk-in, line items service+product, adjustments, tax from Business Settings, payment); (B) From completed appointment; (C) Pending from online booking (void on cancel).
- Status flow: Pending, In Progress, Paid, Partial, Refunded, Partial Refund, Void.
- Detail view: full breakdown, linked customer, linked appointment, staff, payment, notes. Actions: Print receipt, Email receipt, Refund (full/partial + restock prompt), Void (same-day or admin), Edit (same-day or admin).
- Receipts: header/footer from receipt_settings; 80mm thermal print CSS; email via Formspree.
- Appointment linking: prompt to link when creating txn; mark appointment billed; show Billed / Awaiting Payment in appointments.

---

## Phase 4 — Notifications (Section 3)

- Bell already in header; dropdown with recent notifications; mark read.
- Triggers: low stock threshold; new pending txn from online booking; appointment completed with no linked transaction; transaction balance unpaid > 24h.

---

## Phase 5 — Header & Navigation (Section 4)

- User menu: avatar + full name; dropdown: Account Settings, Business Settings, Booking Settings, Billing, **Need Help?**, Log Out (each to dedicated page).
- Settings pages: header title "Settings"; **left arrow** (←) returns to previous page; remove "Back to Main" / "Back to Current" buttons.
- **Pet animation button:** bottom-right corner; **desktop only** (hide on mobile/tablet); label **"Woof!"**; behavior unchanged.

---

## Phase 6 — Account Settings (Section 5)

- **Appearance:** Tabs: (A) Color picker — Primary + Secondary/Accent, live preview, save; (C) Standard themes — 6 preset cards (Ocean, Forest, Sunset, Midnight, Lavender, Slate), click to preview, Save to confirm.
- **Change password:** Current password (server-verified) first; then reveal New + Confirm; full validation.
- **Remove:** Navigation order / draggable menu reorder.

---

## Phase 7 — Business Settings (Section 6)

- **Tax:** Backend tax_settings; region dropdown (Puerto Rico → IVU Estatal 10.5% + IVU Municipal 1%; US/International overridable); up to 3 custom taxes (label, rate, enabled). Used by transactions/receipts.
- **Receipt:** Header (name, logo, address, phone, tagline), footer; live preview; save to receipt_settings.
- **Payment setup:** Placeholder cards (Stripe, ATH Móvil, PayPal, More Coming Soon) — logo, "Coming Soon", greyed "Set Up".
- **Low-stock threshold:** Global default; overridable per product.
- **Data export:** XLSX multi-sheet (Products, Inventory Log, Transactions, Refunds, Orders, Customers, Appointments, Notifications). **Dependency:** exceljs or xlsx — confirm before adding.

---

## Phase 8 — Booking Settings (Section 7)

- Scaffold: services offered, availability, booking window, buffer time. Full logic in later phase.

---

## Phase 9 — Billing (Section 8)

- Scaffold: current plan, renewal, payment on file; upgrade/downgrade; invoice history (date, amount, status, download PDF).

---

## Phase 10 — Need Help (Section 9)

- Rename menu item to **"Need Help?"** (all i18n keys).
- Page: business name from settings; contact email (mailto); form: Name, Email, Subject, Message → Formspree to **admin@stratumpr.com**; success message. No FAQ/docs.

---

## Environment / TODOs

- **Formspree (Help page):** Set `VITE_FORMSPREE_HELP_FORM_ID` to your Formspree form ID so the Need Help form submits to admin@stratumpr.com. Create the form at formspree.io and use the form hash in the URL.
- **Payment gateways:** Stripe, ATH Móvil, PayPal — placeholders only; no API keys until confirmed.
- **XLSX export:** Add `xlsx` or `exceljs` only after confirmation.

---

## Files created or modified (summary)

- Migrations: `supabase/migrations/YYYYMMDD_transactions_and_appointments_billing.sql`
- Inventory: `Inventory.tsx`, `InventoryProductForm.tsx`, `InventoryProductDetailModal.tsx`
- Transactions: new `Transactions.tsx`, `TransactionDetail.tsx`, `TransactionCreate.tsx`, hooks, types
- Nav: `AppSidebar.tsx` (Transactions link)
- Notifications: existing hook; trigger calls from inventory, appointments, transactions
- Layout/Header: `Layout.tsx` (Need Help?), Settings back arrow
- PetAnimations: position + label + desktop-only CSS
- Account: `AccountSettings.tsx` (themes, password flow, remove nav order)
- Business: `BusinessSettingsPage.tsx` (tax DB, receipt, payment cards, export)
- Booking/Billing: scaffold pages
- Help: `Help.tsx` (Formspree, rename), translations
