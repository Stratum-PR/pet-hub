# Transactions schema and RLS

This document describes the database schema and Row Level Security (RLS) for the transactions feature. Tables may have been created via a migration not in this repo (e.g. `transactions_and_appointments_billing.sql`); the migrations in this repo ensure RLS is enabled and policies are applied.

## Tables

### `public.transactions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, default gen_random_uuid() |
| business_id | UUID | FK → businesses(id), NOT NULL |
| customer_id | UUID | FK → clients(id), nullable |
| appointment_id | UUID | FK → appointments(id), nullable |
| staff_id | UUID | FK → profiles(id), nullable |
| created_at | TIMESTAMPTZ | default now() |
| updated_at | TIMESTAMPTZ | optional |
| status | TEXT | e.g. pending, paid, void, refunded |
| payment_method | TEXT | cash, card, ath_movil, other |
| payment_method_secondary | TEXT | nullable |
| subtotal | BIGINT | cents |
| discount_amount | BIGINT | cents |
| discount_label | TEXT | nullable |
| tax_snapshot | JSONB | nullable, array of { label, rate, amount } |
| tip_amount | BIGINT | cents |
| total | BIGINT | cents |
| amount_tendered | BIGINT | cents, nullable |
| change_given | BIGINT | cents, nullable |
| notes | TEXT | nullable |
| transaction_number | INTEGER | nullable, set by trigger |

Trigger: `set_transaction_number()` runs on INSERT to assign a per-business sequence number (see migration `20260218000000_fix_set_transaction_number_search_path.sql`).

### `public.transaction_line_items`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| transaction_id | UUID | FK → transactions(id), NOT NULL |
| type | TEXT | 'service' or 'product' |
| reference_id | UUID | nullable, service_id or product id |
| name | TEXT | NOT NULL |
| quantity | INTEGER | NOT NULL |
| unit_price | BIGINT | cents |
| line_total | BIGINT | cents |

### `public.transaction_refunds`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| transaction_id | UUID | FK → transactions(id) |
| amount | BIGINT | cents |
| reason | TEXT | nullable |
| created_at | TIMESTAMPTZ | default now() |
| staff_id | UUID | nullable, FK → profiles(id) |
| restock_applied | BOOLEAN | default false |

### `public.transaction_history`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| transaction_id | UUID | FK → transactions(id) |
| business_id | UUID | FK → businesses(id) |
| changed_at | TIMESTAMPTZ | default now() |
| changed_by_user_id | UUID | nullable, FK → profiles(id) |
| change_summary | JSONB | array of { field, old_value, new_value } |

## RLS policies

Migrations that apply RLS:

- `20260218100000_transactions_rls_policies.sql` — enables RLS and creates policies on all four tables when they exist.

Pattern:

- **transactions**, **transaction_history**: Policies scoped by `business_id`; user must have `profiles.business_id` equal to the row’s `business_id`, or be `is_super_admin`. SELECT allows super_admin to read any business; INSERT/UPDATE/DELETE restrict to own business.
- **transaction_line_items**, **transaction_refunds**: Policies use a subquery on `transactions` so that access is allowed only when the related transaction’s `business_id` belongs to the user (or user is super_admin for SELECT).

Policy names:

- `"Users can access ... from their business"` — FOR SELECT
- `"Users can manage ... from their business"` — FOR ALL (INSERT/UPDATE/DELETE) with USING and WITH CHECK on business

## Appointments billing fields

- **appointments.transaction_id** (UUID, nullable) — set when a transaction is created from an appointment.
- **appointments.billed** (BOOLEAN, default false) — set true when linked transaction is created.

These are referenced by the app when creating a transaction from an appointment and when showing “Billed” in the UI.
