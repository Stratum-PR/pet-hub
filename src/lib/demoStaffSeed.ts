import { eachDayOfInterval, format, startOfDay } from 'date-fns';
import type { Employee, EmployeeShift } from '@/types';
import { DEMO_WORKSPACE_BUSINESS_ID } from '@/lib/demoWorkspace';
import { t } from '@/lib/translations';

/** Stable IDs so demo UI stays consistent across sessions (DB may use different UUIDs). */
export const DEMO_STAFF_IDS = {
  manager: 'b1000000-0000-4000-8000-000000000000',
  juan: 'b1000000-0000-4000-8000-000000000001',
  sofia: 'b1000000-0000-4000-8000-000000000002',
} as const;

const nowIso = () => new Date().toISOString();

/** Demo manager birthday follows the viewer's local "today" (matches DB sync + notifications). */
function demoManagerBirthdayFields() {
  const n = new Date();
  return {
    birth_month: n.getMonth() + 1,
    birth_day: n.getDate(),
    birth_year: n.getFullYear() - 35,
  };
}

export function isDemoWorkspaceBusiness(businessId: string | null | undefined): boolean {
  return businessId === DEMO_WORKSPACE_BUSINESS_ID;
}

/** In-memory demo staff when `/demo` Supabase `staff` table is empty or unreachable. */
export function getDemoStaffSeed(): Employee[] {
  const ts = nowIso();
  const b = demoManagerBirthdayFields();
  const managerName = t('layout.demoUserName');
  const split = (full: string) => {
    const p = full.trim().split(/\s+/);
    return { first_name: p[0] ?? full, last_name: p.slice(1).join(' ') };
  };
  const mgr = split(managerName);
  return [
    {
      id: DEMO_STAFF_IDS.manager,
      business_id: DEMO_WORKSPACE_BUSINESS_ID,
      first_name: mgr.first_name,
      last_name: mgr.last_name,
      name: managerName,
      email: 'demo.manager@pethub.demo',
      phone: '(787) 555-0000',
      pin: '9999',
      hourly_rate: 32,
      role: 'Manager',
      access_role: 'admin',
      status: 'active',
      birth_month: b.birth_month,
      birth_day: b.birth_day,
      birth_year: b.birth_year,
      offered_service_ids: [],
      created_at: ts,
      updated_at: ts,
    },
    {
      id: DEMO_STAFF_IDS.juan,
      business_id: DEMO_WORKSPACE_BUSINESS_ID,
      first_name: 'Juan',
      last_name: 'Pérez',
      name: 'Juan Pérez',
      email: 'juan.perez@demo.com',
      phone: '(787) 555-1111',
      pin: '1234',
      hourly_rate: 18,
      role: 'groomer',
      access_role: 'staff',
      status: 'active',
      birth_month: 6,
      birth_day: 15,
      birth_year: 1991,
      offered_service_ids: [],
      created_at: ts,
      updated_at: ts,
    },
    {
      id: DEMO_STAFF_IDS.sofia,
      business_id: DEMO_WORKSPACE_BUSINESS_ID,
      first_name: 'Sofía',
      last_name: 'Rivera',
      name: 'Sofía Rivera',
      email: 'sofia.rivera@demo.com',
      phone: '(787) 555-2222',
      pin: '5678',
      hourly_rate: 22,
      role: 'groomer',
      access_role: 'staff',
      status: 'active',
      birth_month: 11,
      birth_day: 8,
      birth_year: 1993,
      offered_service_ids: [],
      created_at: ts,
      updated_at: ts,
    },
  ];
}

/**
 * Mon–Fri 9:00–17:00 local shifts for demo staff for each day in range.
 * Used when anon demo cannot read `staff_shifts` via RLS or the table has no rows.
 */
export function getDemoStaffShiftsForRange(
  range: { start: Date; end: Date } | undefined,
  filterStaffId?: string
): EmployeeShift[] {
  const staff = getDemoStaffSeed().filter((s) => !filterStaffId || s.id === filterStaffId);
  const start = range?.start ? startOfDay(range.start) : startOfDay(new Date());
  const end = range?.end ? startOfDay(range.end) : startOfDay(new Date());
  const days = start <= end ? eachDayOfInterval({ start, end }) : [start];
  const t = nowIso();
  const shifts: EmployeeShift[] = [];

  for (const day of days) {
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    const ymd = format(day, 'yyyy-MM-dd');
    for (const emp of staff) {
      const startTime = new Date(day);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(day);
      endTime.setHours(17, 0, 0, 0);
      shifts.push({
        id: `demo-shift-${emp.id}-${ymd}`,
        business_id: DEMO_WORKSPACE_BUSINESS_ID,
        staff_id: emp.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: 'Demo schedule',
        created_at: t,
        updated_at: t,
      });
    }
  }
  return shifts;
}
