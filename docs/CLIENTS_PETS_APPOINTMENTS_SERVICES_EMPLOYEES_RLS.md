# Clients, Pets, Appointments, Services, Employees — RLS and Performance

This document summarizes Row Level Security (RLS), data hooks, and performance considerations for the core business tables: **clients**, **pets**, **appointments**, **services**, **employees**, and **time_entries**.

## RLS (existing migrations)

- **20250120000000_create_multi_tenant_schema.sql**  
  Adds `business_id` and RLS to **pets**, **services**, **appointments**, **employees**, **time_entries**.  
  Policies: SELECT allowed for users whose `profiles.business_id` matches row `business_id` or user is `is_super_admin`; INSERT/UPDATE/DELETE restricted to own business.

- **20260203120000_ensure_insert_policies.sql**  
  Adds/ensures "Users can manage clients in their business" and "Users can manage inventory from their business" with proper `USING` and `WITH CHECK` on `business_id`.

- **customers vs clients**  
  The multi-tenant schema introduced a `customers` table; the app uses the **clients** table. Migrations may reference both. RLS for **clients** is enforced via the ensure_insert_policies (or equivalent) so that access is scoped by `business_id`.

- **20260219100000_clients_rls_ensure.sql**  
  Idempotent migration that enables RLS on **clients** if the table exists, drops any permissive/legacy policies, and creates business-scoped SELECT and ALL policies (aligned with other business tables).

## Data hooks (useSupabaseData.ts)

| Hook | Tables / queries | Error handling | Demo cap |
|------|------------------|----------------|----------|
| useBreeds | breeds | `error`, `refetch` | — |
| useClientNames | clients (id, first_name, last_name, email) | `error`, `refetch` | 200 |
| useClients | clients (*) | `error`, `refetch` | 200 |
| usePets | pets + clients + breeds (join) | `error`, `refetch` | 200 |
| useEmployees | employees (*) | `error`, `refetch` | 100 |
| useTimeEntries | time_entries (via employee_ids) | `error`, `refetch` | 500 |
| useAppointments | appointments (*) | `error`, `refetch` | 300 |
| useServices | services (*) | `error`, `refetch` | — |

- On fetch failure, hooks set `error` and do **not** overwrite existing data; callers can show a message and use `refetch()`.
- All `console.*` in these hooks are gated with `import.meta.env.DEV` to avoid production noise and information leakage.

## Performance and database strain

- **Payload**: List views use full `select('*')` for clients, pets, appointments, services, employees. For list-only UIs, consider explicit column lists (e.g. id, name, key dates) to reduce payload size.
- **Pets**: Single query with joins to `clients` and `breeds`; no N+1. Demo cap 200.
- **Time entries**: One query for employee ids, then one query for entries by those ids; batched.
- **Caching**: No in-hook caching for these entities; each mount fetches. Shared data (e.g. services list on multiple pages) is refetched per page. Consider caching or a shared store if needed.
- **useBusinessData.ts**: Hooks for Business* pages now use the same error/refetch pattern and dev-only logging; list selects remain `*` (can be narrowed later for list-only views).

## Security checklist

- [ ] RLS enabled on **clients**, **pets**, **appointments**, **services**, **employees**, **time_entries**.
- [ ] Policies restrict by `business_id` (and optionally `is_super_admin` for SELECT).
- [ ] No `USING (true)` or permissive policies in production for these tables.
- [ ] Sensitive operations (e.g. delete client, update employee) rely on RLS; client-side checks are defense-in-depth only.

## Validation and tests

- **Transactions**: `src/lib/transactionValidation.ts` with unit tests.
- **Clients, pets, services, appointments**: `src/lib/businessValidation.ts` provides `validateClientPayload`, `validatePetPayload`, `validateServicePayload`, `validateAppointmentPayload` (required fields, UUIDs, formats, non-negative numbers). Unit tests in `src/lib/businessValidation.test.ts`. Used in `useBusinessData` add* functions to reject invalid payloads before DB calls; UI can call the same validators before submit for immediate feedback.
