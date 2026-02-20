# Migration Order Guide

## Time Kiosk System Migrations

The migrations for the time kiosk system should be run in the following order:

### 1. Base Schema Migrations (Run First)
These create the foundational tables and columns:

1. `20260221000000_enhance_time_entries.sql` - Adds geolocation, rounding, status columns to time_entries
2. `20260221000001_time_entry_edit_requests.sql` - Creates time_entry_edit_requests table
3. `20260221000002_manager_kiosk_pin.sql` - Adds manager PIN to businesses
4. `20260221000003_employee_pin_setup.sql` - Adds PIN setup tracking to employees
5. `20260221000004_time_entry_edit_requests_rls.sql` - Creates RLS policies for edit requests

### 2. Utility Functions (Run After Schema)
These functions are used by other functions:

6. `20260221000005_round_time_rpc.sql` - Time rounding function
7. `20260221000006_check_schedule_rpc.sql` - Schedule checking function
8. `20260221000007_calculate_overtime_rpc.sql` - Overtime calculation function

### 3. Main Functions (Run After Utilities)
These depend on the utility functions:

9. `20260221000008_clock_in_out_rpc.sql` - Main clock in/out function (uses round_time, check_schedule, and check_geofence)

### 4. Geofencing (Run After Main Functions)
Geofencing depends on the clock_in_out function:

10. `20260221000009_geofencing.sql` - Geofencing schema and functions (check_geofence is used by clock_in_out)

**Note:** The `clock_in_out` function was updated to use `check_geofence`, so if you're running migrations fresh, you can run them in order. If you already ran `20260221000008_clock_in_out_rpc.sql` before adding geofencing, you'll need to re-run it after `20260221000009_geofencing.sql` to include the geofencing check.

## Recommended Migration Order

```bash
# Run in this exact order:
1. 20260221000000_enhance_time_entries.sql
2. 20260221000001_time_entry_edit_requests.sql  # MUST run before 00004
3. 20260221000002_manager_kiosk_pin.sql
4. 20260221000003_employee_pin_setup.sql
5. 20260221000004_time_entry_edit_requests_rls.sql  # Requires table from 00001
6. 20260221000005_round_time_rpc.sql
7. 20260221000006_check_schedule_rpc.sql
8. 20260221000007_calculate_overtime_rpc.sql
9. 20260221000009_geofencing.sql  # Run BEFORE clock_in_out
10. 20260221000008_clock_in_out_rpc.sql  # Run AFTER geofencing (includes geofence check)
```

**Important:** Migration `00004` (RLS policies) requires the `time_entry_edit_requests` table to exist, which is created in migration `00001`. Make sure `00001` runs successfully before `00004`.

## If Migrations Already Ran

If you've already run `20260221000008_clock_in_out_rpc.sql` before adding geofencing:

1. Run `20260221000009_geofencing.sql` first
2. Then re-run `20260221000008_clock_in_out_rpc.sql` to update the function with geofencing support

The function will be replaced (CREATE OR REPLACE), so it's safe to re-run.

## Verification

After running all migrations, verify:

1. Check that all columns exist:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'time_entries' AND column_name IN ('location_latitude', 'rounded_clock_in', 'status');
   ```

2. Check that functions exist:
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('clock_in_out', 'check_geofence', 'round_time_to_interval');
   ```

3. Test geofencing:
   ```sql
   -- Replace with your actual business UUID
   SELECT public.check_geofence(
     '00000000-0000-0000-0000-000000000001'::uuid,  -- Replace with your business_id
     18.2208,  -- latitude
     -66.5901  -- longitude
   );
   
   -- Or get your business ID first:
   SELECT id FROM public.businesses LIMIT 1;
   -- Then use that ID in the check_geofence call
   ```

