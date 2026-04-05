import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Eye, EyeOff, Users, Clock, RotateCcw, RefreshCw, X, Upload, UserRound, Loader2, Pencil, CheckCircle, ListPlus, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DetailModalActionBar } from '@/components/DetailModalActionBar';
import { Employee, StaffAccessRole } from '@/types';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { t } from '@/lib/translations';
import {
  employeeBirthPartsToDateInput,
  employeeDobInputBounds,
  isValidEmployeeDob,
  parseEmployeeDobDateInput,
} from '@/lib/employeeDob';
import { EMPLOYEE_PIN_LENGTH } from '@/lib/pinLengths';
import { generateUniqueEmployeePin } from '@/lib/employeePin';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { toast } from 'sonner';
import { localYmdToTimestamptzIso, timestamptzToDateInputValue } from '@/lib/localDateInput';
import {
  PUERTO_RICO_BANK_ROUTING,
  normalizeRoutingDigits,
  findPuertoRicoBankByRouting,
} from '@/lib/puertoRicoBankRouting';
import { deleteStaffPhotoFromStorage, uploadStaffPhotoDataUrl } from '@/lib/staffPhotoStorage';
import { clearPetHubBirthdayJobLocalKey } from '@/lib/demoManagerBirthdaySync';
import { isDemoWorkspaceBusiness } from '@/lib/demoStaffSeed';
import { requestNotificationsRefetch } from '@/lib/notificationRefetch';
import { dispatchStaffBirthdaysForBusiness } from '@/lib/staffBirthdayDispatch';
import { consumeLastStaffWriteError, useServices } from '@/hooks/useSupabaseData';
import { useStaffJobTitles } from '@/hooks/useStaffJobTitles';
import { employeeFullName } from '@/lib/employeeName';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { InviteEmployeeDialog } from '@/components/employee/InviteEmployeeDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SearchFilter } from '@/components/SearchFilter';
import type { Service } from '@/types';

function serviceRowIsActive(s: Service): boolean {
  return (s as { is_active?: boolean }).is_active !== false;
}

function sanitizeOfferedServiceIds(ids: string[], catalog: Service[]): string[] {
  const allow = new Set(catalog.map((x) => x.id));
  return ids.filter((id) => allow.has(id));
}

function OfferedServicesPickGrid({
  catalogServices,
  selectedIds,
  onToggleId,
}: {
  catalogServices: Service[];
  selectedIds: string[];
  onToggleId: (id: string) => void;
}) {
  if (catalogServices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('employeeManagement.servicesOfferedNoCatalog')}</p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {catalogServices.map((svc) => {
        const selected = selectedIds.includes(svc.id);
        return (
          <Button
            key={svc.id}
            type="button"
            variant={selected ? 'default' : 'outline'}
            className="h-auto justify-start py-2.5"
            onClick={() => onToggleId(svc.id)}
          >
            <span
              className={cn(
                'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                selected ? 'border-primary-foreground bg-primary-foreground/20' : 'border-border'
              )}
            >
              {selected ? <CheckCircle className="h-3 w-3" /> : null}
            </span>
            <span className="min-w-0 flex-1 text-left font-medium">{svc.name}</span>
          </Button>
        );
      })}
    </div>
  );
}

function resolvedAccessRole(emp: Employee): StaffAccessRole {
  const a = emp.access_role;
  if (a === 'manager' || a === 'staff' || a === 'admin' || a === 'contractor') return a;
  return emp.role === 'manager' ? 'manager' : 'staff';
}

function formatJobTitleForBadge(role: string): string {
  const s = role.trim();
  if (!s) return '—';
  return s
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function resolveJobTitleIdFromEmployee(
  employee: Employee,
  titles: { id: string; title: string }[],
): string {
  if (employee.job_title_id) return employee.job_title_id;
  const r = (employee.role ?? '').trim().toLowerCase();
  if (!r) return '';
  return titles.find((t) => t.title.toLowerCase() === r)?.id ?? '';
}

/** Job title (groomer, Manager, …) next to name; color hints at access tier. */
function JobTitleBadge({ employee }: { employee: Employee }) {
  const tier: StaffAccessRole = resolvedAccessRole(employee);
  const label = formatJobTitleForBadge(employee.role);
  const cls =
    tier === 'manager'
      ? 'bg-blue-600 text-white'
      : tier === 'admin'
        ? 'bg-amber-500 text-white'
        : tier === 'contractor'
          ? 'bg-violet-600 text-white'
          : 'bg-slate-600 text-white';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

/** Local calendar date (no time / TZ shift for display math). */
function atLocalDay(isoOrDate: string | Date): Date {
  const x = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/** Parse `YYYY-MM-DD` from a date input as a local calendar day. */
function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d);
}

function calendarDiffYMD(start: Date, end: Date): { y: number; m: number; d: number } {
  let y = end.getFullYear() - start.getFullYear();
  let m = end.getMonth() - start.getMonth();
  let d = end.getDate() - start.getDate();
  if (d < 0) {
    m -= 1;
    d += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  return { y, m, d };
}

function formatTenureYMD(y: number, mo: number, d: number, lang: string): string {
  const es = lang === 'es';
  const parts: string[] = [];
  if (y > 0) parts.push(es ? `${y} ${y === 1 ? 'año' : 'años'}` : `${y} ${y === 1 ? 'year' : 'years'}`);
  if (mo > 0) parts.push(es ? `${mo} ${mo === 1 ? 'mes' : 'meses'}` : `${mo} ${mo === 1 ? 'month' : 'months'}`);
  if (d > 0) parts.push(es ? `${d} ${d === 1 ? 'día' : 'días'}` : `${d} ${d === 1 ? 'day' : 'days'}`);
  if (parts.length === 0) return es ? '0 días' : '0 days';
  return parts.join(es ? ', ' : ', ');
}

function formatEmployeeLocaleDate(iso: string | undefined, lang: string): string {
  if (!iso) return '';
  return atLocalDay(iso).toLocaleDateString(lang === 'es' ? 'es' : 'en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatStaffDobFromParts(emp: Employee, lang: string): string {
  if (
    emp.birth_month != null &&
    emp.birth_day != null &&
    emp.birth_month >= 1 &&
    emp.birth_month <= 12 &&
    emp.birth_day >= 1 &&
    emp.birth_day <= 31
  ) {
    const y = emp.birth_year ?? 2000;
    const d = new Date(y, emp.birth_month - 1, emp.birth_day);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(lang === 'es' ? 'es' : 'en', {
        year: emp.birth_year ? 'numeric' : undefined,
        month: 'long',
        day: 'numeric',
      });
    }
  }
  return '—';
}

function accessRoleLabel(emp: Employee, t: (k: string) => string): string {
  const ar = resolvedAccessRole(emp);
  if (ar === 'admin') return t('employeeManagement.accessRoleAdmin');
  if (ar === 'manager') return t('employeeManagement.accessRoleManager');
  if (ar === 'contractor') return t('employeeManagement.accessRoleContractor');
  return t('employeeManagement.accessRoleStaff');
}

function EmployeeSelfReadOnlyProfile({
  employee: emp,
  lang,
  todayLocal,
  onEdit,
  onManageServices,
  catalogServices,
}: {
  employee: Employee;
  lang: string;
  todayLocal: Date;
  onEdit?: () => void;
  onManageServices?: () => void;
  catalogServices: Service[];
}) {
  const offeredLabels = useMemo(() => {
    const ids = emp.offered_service_ids ?? [];
    if (!ids.length) return [] as string[];
    const byId = new Map(catalogServices.map((s) => [s.id, s.name]));
    return ids.map((id) => byId.get(id)).filter((n): n is string => Boolean(n)).sort((a, b) => a.localeCompare(b));
  }, [emp.offered_service_ids, catalogServices]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
              {emp.photo_url ? (
                <img src={emp.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight">{employeeFullName(emp)}</h2>
                  <div>
                    <JobTitleBadge employee={emp} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                    {emp.status}
                  </span>
                  {emp.status === 'active' && onEdit ? (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
                      <Pencil className="h-3.5 w-3.5" />
                      {t('common.edit')}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-1 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">{t('employeePayroll.employee.email')}</span>{' '}
                  <span className="break-all">{emp.email || '—'}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">{t('employeePayroll.employee.phone')}</span>{' '}
                  <span>{emp.phone ? formatPhoneNumber(emp.phone) : '—'}</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('employeePayroll.employeeInformation')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">{t('employeeManagement.accessRoleLabel')}</p>
            <p className="font-medium">{accessRoleLabel(emp, t)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('employeeManagement.compensationType')}</p>
            <p className="font-medium">
              {emp.compensation_type === 'commission'
                ? t('employeeManagement.compensationCommission')
                : t('employeeManagement.compensationHourly')}
            </p>
          </div>
          {emp.compensation_type === 'commission' && emp.commission_rate != null ? (
            <div>
              <p className="text-muted-foreground">{t('employeeManagement.commissionRate')}</p>
              <p className="font-medium">{Number(emp.commission_rate)}%</p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground">{t('employeePayroll.employee.hourlyRate')}</p>
              <p className="font-medium">${emp.hourly_rate}/hr</p>
            </div>
          )}
          {emp.hire_date ? (
            <div>
              <p className="text-muted-foreground">{t('employeeManagement.fieldHireDate')}</p>
              <p className="font-medium">{formatEmployeeLocaleDate(emp.hire_date, lang)}</p>
            </div>
          ) : null}
          {emp.status === 'inactive' && emp.last_date ? (
            <div>
              <p className="text-muted-foreground">{t('employeeManagement.lastDateFieldLabel')}</p>
              <p className="font-medium">{formatEmployeeLocaleDate(emp.last_date, lang)}</p>
            </div>
          ) : null}
          <div>
            <p className="text-muted-foreground">{t('employeeManagement.dateOfBirthLabel')}</p>
            <p className="font-medium">{formatStaffDobFromParts(emp, lang)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <CardTitle className="text-base">{t('employeeManagement.servicesOfferedTitle')}</CardTitle>
          {emp.status === 'active' && onManageServices ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={onManageServices}
            >
              <ListPlus className="h-3.5 w-3.5" />
              {t('employeeManagement.addServicesButton')}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {offeredLabels.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {offeredLabels.map((name, i) => (
                <li
                  key={`${name}-${i}`}
                  className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-sm font-medium"
                >
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t('employeeManagement.servicesOfferedEmptyRead')}</p>
          )}
          <p className="text-xs text-muted-foreground">{t('employeeManagement.servicesOfferedHint')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('employeeManagement.paymentSection')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">{t('employeeManagement.routingNumber')}</p>
            <p className="font-mono font-medium">{emp.bank_routing_number?.trim() || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('employeeManagement.bankName')}</p>
            <p className="font-medium">{emp.bank_name?.trim() || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('employeeManagement.accountNumber')}</p>
            <p className="font-mono font-medium">{emp.bank_account_number?.trim() || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">{t('employeeManagement.paymentNotes')}</p>
            <p className="font-medium">{emp.payment_notes?.trim() || '—'}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {emp.status === 'active' && emp.hire_date ? (
          <div className="rounded-md border border-border bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
            {t('employeeManagement.tenureToDate', {
              tenure: (() => {
                const { y, m, d } = calendarDiffYMD(atLocalDay(emp.hire_date!), todayLocal);
                return formatTenureYMD(y, m, d, lang);
              })(),
            })}
          </div>
        ) : null}
        {emp.status === 'inactive' && emp.hire_date && emp.last_date ? (
          <div className="rounded-md border border-border bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
            {t('employeeManagement.timeWithCompany', {
              tenure: (() => {
                const { y, m, d } = calendarDiffYMD(atLocalDay(emp.hire_date!), atLocalDay(emp.last_date!));
                return formatTenureYMD(y, m, d, lang);
              })(),
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface EmployeeManagementProps {
  employees: Employee[];
  /** When the staff list query fails (RLS, network, etc.) */
  loadError?: string | null;
  onRetryLoad?: () => void;
  /** While true, avoid showing the “no staff” empty-state */
  loading?: boolean;
  onAddEmployee: (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateEmployee: (id: string, employee: Partial<Employee>) => void | Promise<unknown>;
}

export function EmployeeManagement({ 
  employees, 
  loadError,
  onRetryLoad,
  loading = false,
  onAddEmployee, 
  onUpdateEmployee, 
}: EmployeeManagementProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const businessId = useBusinessId();
  const { services: catalogServices } = useServices();
  const { titles: jobTitles, addTitle, jobTitlesSchemaUnavailable, refetch: refetchJobTitles } =
    useStaffJobTitles();
  const { staffId, isAdmin: isSuperAdmin, business, role } = useAuth();
  const demoBrowseOnly = useDemoBrowseOnly();
  const isEmployeeSelfService = role === 'employee';

  const myStaffAccessRole = useMemo((): StaffAccessRole | null => {
    if (!staffId) return null;
    const me = employees.find((e) => e.id === staffId);
    return me ? resolvedAccessRole(me) : null;
  }, [staffId, employees]);

  const canEditStaffAccessRoles =
    isSuperAdmin || myStaffAccessRole === 'admin' || myStaffAccessRole === 'manager';
  const canAssignAdminAccessRole = isSuperAdmin || myStaffAccessRole === 'admin';
  const canSendPortalInvite = (canEditStaffAccessRoles || isSuperAdmin) && !demoBrowseOnly;

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<Employee | null>(null);
  const [pendingInviteStaffIds, setPendingInviteStaffIds] = useState<Set<string>>(() => new Set());

  const refreshPendingInvites = useCallback(async () => {
    if (!businessId || demoBrowseOnly) return;
    const { data } = await supabase
      .from('staff_invites')
      .select('staff_id')
      .eq('business_id', businessId)
      .eq('status', 'pending');
    setPendingInviteStaffIds(new Set((data ?? []).map((r) => String(r.staff_id))));
  }, [businessId, demoBrowseOnly]);

  useEffect(() => {
    void refreshPendingInvites();
  }, [refreshPendingInvites, employees.length]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPin, setShowPin] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [removeLastWorkingDate, setRemoveLastWorkingDate] = useState('');
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [employeeToReactivate, setEmployeeToReactivate] = useState<string | null>(null);
  const [reactivateStartDate, setReactivateStartDate] = useState('');
  const [servicesOnlyDialogOpen, setServicesOnlyDialogOpen] = useState(false);
  const [servicesOnlyDraftIds, setServicesOnlyDraftIds] = useState<string[]>([]);
  const [jobTitleDialogOpen, setJobTitleDialogOpen] = useState(false);
  const [newJobTitleInput, setNewJobTitleInput] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    job_title_id: '',
    email: '',
    phone: '',
    pin: '',
    hourly_rate: 15,
    access_role: 'staff' as StaffAccessRole,
    status: 'active' as 'active' | 'inactive',
    hire_date: '',
    last_date: '',
    dob_date: '',
    photo_url: null as string | null,
    compensation_type: 'hourly' as 'hourly' | 'commission',
    commission_rate: '' as number | '',
    bank_routing_number: '',
    bank_account_number: '',
    bank_name: '',
    payment_notes: '',
    offered_service_ids: [] as string[],
  });
  const [originalStaffPhotoUrl, setOriginalStaffPhotoUrl] = useState<string | null>(null);
  const [staffPhotoUploading, setStaffPhotoUploading] = useState(false);
  const staffPhotoInputRef = useRef<HTMLInputElement>(null);
  const [showPinInForm, setShowPinInForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const STAFF_DIRECTORY_VIEW_KEY = 'pet-hub-staff-directory-view';
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    return window.localStorage.getItem(STAFF_DIRECTORY_VIEW_KEY) === 'list' ? 'list' : 'cards';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STAFF_DIRECTORY_VIEW_KEY, viewMode);
  }, [viewMode]);

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.status === statusFilter),
    [employees, statusFilter]
  );

  const staffDirectoryList = useMemo(() => {
    if (isEmployeeSelfService) return [];
    const term = staffSearchTerm.trim().toLowerCase();
    if (!term) return filteredEmployees;
    return filteredEmployees.filter((e) => {
      const name = employeeFullName(e).toLowerCase();
      const email = (e.email ?? '').toLowerCase();
      const phoneDigits = (e.phone ?? '').replace(/\D/g, '');
      const termDigits = term.replace(/\D/g, '');
      const role = (e.role ?? '').toLowerCase();
      const phoneMatch = termDigits.length > 0 && phoneDigits.includes(termDigits);
      return name.includes(term) || email.includes(term) || role.includes(term) || phoneMatch;
    });
  }, [isEmployeeSelfService, filteredEmployees, staffSearchTerm]);

  const listForGrid = useMemo(() => {
    if (isEmployeeSelfService && staffId) {
      const me = employees.find((e) => e.id === staffId);
      return me ? [me] : [];
    }
    return filteredEmployees;
  }, [isEmployeeSelfService, staffId, employees, filteredEmployees]);

  const staffFormCatalogServices = useMemo(
    () => [...catalogServices].filter(serviceRowIsActive).sort((a, b) => a.name.localeCompare(b.name)),
    [catalogServices]
  );

  const openEmployeeServicesDialog = useCallback(() => {
    const me = staffId ? employees.find((e) => e.id === staffId) : null;
    if (!me || me.status !== 'active') return;
    setServicesOnlyDraftIds([...(me.offered_service_ids ?? [])]);
    setServicesOnlyDialogOpen(true);
  }, [staffId, employees]);

  const saveEmployeeServicesDialog = useCallback(async () => {
    if (!staffId) return;
    const next = sanitizeOfferedServiceIds(servicesOnlyDraftIds, catalogServices);
    const updated = await onUpdateEmployee(staffId, { offered_service_ids: next });
    if (updated == null) {
      const det = consumeLastStaffWriteError();
      toast.error(
        det
          ? `${t('employeeManagement.saveStaffFailed')} (${det.code ?? 'error'}: ${det.message})`
          : t('employeeManagement.saveStaffFailed')
      );
      return;
    }
    setServicesOnlyDialogOpen(false);
  }, [staffId, servicesOnlyDraftIds, catalogServices, onUpdateEmployee]);

  useEffect(() => {
    setStaffModalOpen(false);
    setEditingEmployee(null);
  }, [statusFilter]);

  useEffect(() => {
    if (!staffModalOpen || !businessId) return;
    if (editingEmployee) {
      const p = editingEmployee.pin;
      if (typeof p === 'string' && new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(p)) return;
    }
    let cancelled = false;
    (async () => {
      try {
        const next = await generateUniqueEmployeePin(supabase, businessId, {
          excludeEmployeeId: editingEmployee?.id,
        });
        if (!cancelled) setFormData((fd) => ({ ...fd, pin: next }));
      } catch {
        if (!cancelled) setFormData((fd) => ({ ...fd, pin: '' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staffModalOpen, businessId, editingEmployee?.id, editingEmployee?.pin]);

  useEffect(() => {
    if (!staffModalOpen || !editingEmployee) return;
    setFormData((fd) => {
      if (fd.job_title_id) return fd;
      const id = resolveJobTitleIdFromEmployee(editingEmployee, jobTitles);
      return id ? { ...fd, job_title_id: id } : fd;
    });
  }, [staffModalOpen, editingEmployee, jobTitles]);

  const handleGenerateFormPin = useCallback(async () => {
    if (!businessId) return;
    try {
      const next = await generateUniqueEmployeePin(supabase, businessId, {
        excludeEmployeeId: editingEmployee?.id,
      });
      setFormData((fd) => ({ ...fd, pin: next }));
    } catch {
      alert(t('employeeManagement.pinMissingError'));
    }
  }, [businessId, editingEmployee?.id]);

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      job_title_id: '',
      email: '',
      phone: '',
      pin: '',
      hourly_rate: 15,
      access_role: 'staff',
      status: 'active',
      hire_date: '',
      last_date: '',
      dob_date: '',
      photo_url: null,
      compensation_type: 'hourly',
      commission_rate: '',
      bank_routing_number: '',
      bank_account_number: '',
      bank_name: '',
      payment_notes: '',
      offered_service_ids: [],
    });
    setOriginalStaffPhotoUrl(null);
    setShowPinInForm(false);
    if (staffPhotoInputRef.current) staffPhotoInputRef.current.value = '';
  };

  const closeStaffModal = () => {
    setStaffModalOpen(false);
    setEditingEmployee(null);
    resetForm();
  };

  const handleStaffPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('common.genericError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('employeeManagement.profilePhotoHint'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setFormData((fd) => ({ ...fd, photo_url: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(formData.pin)) {
      alert(t('employeeManagement.pinMissingError'));
      return;
    }

    const emailTrim = String(formData.email ?? '').trim();
    if (!emailTrim) {
      toast.warning(t('employeeManagement.emailActivationWarning'));
    }

    const routingDigits = normalizeRoutingDigits(formData.bank_routing_number);
    if (formData.bank_routing_number.trim() && routingDigits.length !== 9) {
      alert(t('employeeManagement.routingInvalid'));
      return;
    }

    let hireIso: string | null = null;
    let lastIso: string | null = null;
    if (!isEmployeeSelfService) {
      hireIso = formData.hire_date ? localYmdToTimestamptzIso(formData.hire_date) : null;
      lastIso =
        formData.status === 'inactive' && formData.last_date
          ? localYmdToTimestamptzIso(formData.last_date)
          : null;
      if (formData.hire_date && !hireIso) {
        alert(t('common.genericError'));
        return;
      }
      if (formData.status === 'inactive' && formData.last_date && !lastIso) {
        alert(t('common.genericError'));
        return;
      }
    }

    const dobTrim = String(formData.dob_date ?? '').trim();
    let birth_month: number | null = null;
    let birth_day: number | null = null;
    let birth_year: number | null = null;
    if (dobTrim) {
      const parts = parseEmployeeDobDateInput(dobTrim);
      if (!parts) {
        alert(t('employeeManagement.dobInvalid'));
        return;
      }
      const { day, month, year } = parts;
      if (!isValidEmployeeDob(day, month, year)) {
        alert(t('employeeManagement.dobInvalid'));
        return;
      }
      birth_month = month;
      birth_day = day;
      birth_year = year;
    }
    const allDob = birth_month !== null && birth_day !== null && birth_year !== null;

    if (!isEmployeeSelfService) {
      if (!formData.first_name.trim()) {
        toast.error(t('employeeManagement.firstNameRequired'));
        return;
      }
      if (!formData.job_title_id) {
        toast.error(t('employeeManagement.jobTitleRequired'));
        return;
      }
    } else {
      if (!formData.first_name.trim()) {
        toast.error(t('employeeManagement.firstNameRequired'));
        return;
      }
    }

    if (!isEmployeeSelfService) {
      const activeAdmins = employees.filter(
        (e) => e.status === 'active' && resolvedAccessRole(e) === 'admin'
      );
      const editingWasAdmin = editingEmployee && resolvedAccessRole(editingEmployee) === 'admin';
      if (
        editingWasAdmin &&
        formData.access_role !== 'admin' &&
        activeAdmins.length === 1 &&
        activeAdmins[0]?.id === editingEmployee!.id
      ) {
        toast.error(t('employeeManagement.lastAdminGuard'));
        return;
      }

      const activeManagers = employees.filter(
        (e) => e.status === 'active' && resolvedAccessRole(e) === 'manager'
      );
      const editingWasManager = editingEmployee && resolvedAccessRole(editingEmployee) === 'manager';
      if (
        editingWasManager &&
        formData.access_role !== 'manager' &&
        activeManagers.length === 1 &&
        activeManagers[0]?.id === editingEmployee!.id
      ) {
        toast.error(t('employeeManagement.lastManagerGuard'));
        return;
      }

      if (
        myStaffAccessRole === 'manager' &&
        !isSuperAdmin &&
        formData.access_role === 'admin'
      ) {
        toast.error(t('employeeManagement.accessRoleManagersCannotAssignAdmin'));
        return;
      }
    }

    let finalPhotoUrl: string | null = formData.photo_url;

    if (!demoBrowseOnly && businessId) {
      const hadHttpOriginal =
        originalStaffPhotoUrl &&
        originalStaffPhotoUrl.startsWith('http') &&
        !originalStaffPhotoUrl.startsWith('data:');
      const replacingOrRemoving =
        !formData.photo_url ||
        (formData.photo_url.startsWith('data:image/') && hadHttpOriginal);
      if (hadHttpOriginal && replacingOrRemoving) {
        await deleteStaffPhotoFromStorage(supabase, originalStaffPhotoUrl);
      }
      if (formData.photo_url?.startsWith('data:image/')) {
        setStaffPhotoUploading(true);
        const up = await uploadStaffPhotoDataUrl(supabase, businessId, formData.photo_url);
        setStaffPhotoUploading(false);
        if ('error' in up) {
          toast.error(up.error);
          return;
        }
        finalPhotoUrl = up.publicUrl;
      } else if (!formData.photo_url && hadHttpOriginal) {
        finalPhotoUrl = null;
      }
    } else if (demoBrowseOnly) {
      finalPhotoUrl = formData.photo_url;
    }

    if (isEmployeeSelfService) {
      if (!editingEmployee) {
        toast.error(t('employeeManagement.saveStaffFailed'));
        return;
      }
      const selfSubmit: Record<string, unknown> = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: emailTrim,
        phone: unformatPhoneNumber(formData.phone),
        pin: formData.pin,
        birth_month,
        birth_day,
        birth_year,
        photo_url: finalPhotoUrl,
        bank_routing_number: routingDigits || null,
        bank_account_number: formData.bank_account_number.trim() || null,
        bank_name: formData.bank_name.trim() || null,
        payment_notes: formData.payment_notes.trim() || null,
        offered_service_ids: sanitizeOfferedServiceIds(formData.offered_service_ids, catalogServices),
      };
      if (selfSubmit.pin && String(selfSubmit.pin).length === EMPLOYEE_PIN_LENGTH) {
        const isNewPin = editingEmployee.pin !== selfSubmit.pin;
        if (isNewPin) {
          selfSubmit.pin_set_at = new Date().toISOString();
          selfSubmit.pin_required = false;
        }
      }
      const updated = await onUpdateEmployee(editingEmployee.id, selfSubmit as Partial<Employee>);
      if (updated == null) {
        const det = consumeLastStaffWriteError();
        toast.error(
          det
            ? `${t('employeeManagement.saveStaffFailed')} (${det.code ?? 'error'}: ${det.message})`
            : t('employeeManagement.saveStaffFailed')
        );
        return;
      }
      if (allDob && birth_month !== null && birth_day !== null && !demoBrowseOnly) {
        const { error: bdayErr } = await dispatchStaffBirthdaysForBusiness(businessId);
        if (bdayErr) toast.error(bdayErr);
        else if (isDemoWorkspaceBusiness(businessId)) clearPetHubBirthdayJobLocalKey(businessId);
        requestNotificationsRefetch();
      }
      closeStaffModal();
      return;
    }

    const commission_rate =
      formData.compensation_type === 'commission' && formData.commission_rate !== ''
        ? Number(formData.commission_rate)
        : null;

    const selectedJobTitle = jobTitles.find((x) => x.id === formData.job_title_id);
    const roleForRow = selectedJobTitle?.title ?? 'Staff';
    const displayName = [formData.first_name.trim(), formData.last_name.trim()]
      .filter(Boolean)
      .join(' ')
      .trim();

    const submitData: Record<string, unknown> = {
      name: displayName || roleForRow,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      job_title_id: formData.job_title_id || null,
      email: emailTrim,
      phone: unformatPhoneNumber(formData.phone),
      pin: formData.pin,
      hourly_rate: Number(formData.hourly_rate),
      role: roleForRow,
      access_role: formData.access_role,
      status: formData.status,
      hire_date: hireIso,
      last_date: formData.status === 'inactive' ? lastIso : null,
      birth_month,
      birth_day,
      birth_year,
      photo_url: finalPhotoUrl,
      compensation_type: formData.compensation_type,
      commission_rate,
      bank_routing_number: routingDigits || null,
      bank_account_number: formData.bank_account_number.trim() || null,
      bank_name: formData.bank_name.trim() || null,
      payment_notes: formData.payment_notes.trim() || null,
      offered_service_ids: sanitizeOfferedServiceIds(formData.offered_service_ids, catalogServices),
    };

    if (!canEditStaffAccessRoles) {
      delete submitData.access_role;
    }

    if (submitData.pin && String(submitData.pin).length === EMPLOYEE_PIN_LENGTH) {
      const isNewPin = !editingEmployee || editingEmployee.pin !== submitData.pin;
      if (isNewPin) {
        submitData.pin_set_at = new Date().toISOString();
        submitData.pin_required = false;
      }
    }

    if (editingEmployee) {
      const updated = await onUpdateEmployee(editingEmployee.id, submitData);
      if (updated == null) {
        const det = consumeLastStaffWriteError();
        toast.error(
          det
            ? `${t('employeeManagement.saveStaffFailed')} (${det.code ?? 'error'}: ${det.message})`
            : t('employeeManagement.saveStaffFailed')
        );
        return;
      }
    } else {
      if (submitData.pin && String(submitData.pin).length === EMPLOYEE_PIN_LENGTH) {
        submitData.pin_set_at = new Date().toISOString();
        submitData.pin_required = false;
      }
      const created = await onAddEmployee(submitData as Omit<Employee, 'id' | 'created_at' | 'updated_at'>);
      if (created == null) {
        const det = consumeLastStaffWriteError();
        toast.error(
          det
            ? `${t('employeeManagement.saveStaffFailed')} (${det.code ?? 'error'}: ${det.message})`
            : t('employeeManagement.saveStaffFailed')
        );
        return;
      }
    }
    // Let the RPC decide "today" using business timezone (settings). Client local date often mismatched.
    if (allDob && birth_month !== null && birth_day !== null && !demoBrowseOnly) {
      const { error: bdayErr } = await dispatchStaffBirthdaysForBusiness(businessId);
      if (bdayErr) toast.error(bdayErr);
      else if (isDemoWorkspaceBusiness(businessId)) clearPetHubBirthdayJobLocalKey(businessId);
      requestNotificationsRefetch();
    }
    closeStaffModal();
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setOriginalStaffPhotoUrl(employee.photo_url ?? null);
    setFormData({
      first_name:
        (employee.first_name ?? '').trim() ||
        (employee.name ?? '').trim().split(/\s+/)[0] ||
        '',
      last_name:
        (employee.last_name ?? '').trim() ||
        (employee.name ?? '').trim().split(/\s+/).slice(1).join(' ') ||
        '',
      job_title_id: employee.job_title_id ?? resolveJobTitleIdFromEmployee(employee, jobTitles),
      email: employee.email,
      phone: formatPhoneNumber(employee.phone),
      pin: employee.pin,
      hourly_rate: employee.hourly_rate,
      access_role: resolvedAccessRole(employee),
      status: employee.status,
      hire_date: timestamptzToDateInputValue(employee.hire_date),
      last_date: timestamptzToDateInputValue(employee.last_date),
      dob_date: employeeBirthPartsToDateInput(employee.birth_month, employee.birth_day, employee.birth_year),
      photo_url: employee.photo_url ?? null,
      compensation_type:
        employee.compensation_type === 'commission' ? 'commission' : 'hourly',
      commission_rate:
        employee.commission_rate != null && !Number.isNaN(Number(employee.commission_rate))
          ? Number(employee.commission_rate)
          : '',
      bank_routing_number: employee.bank_routing_number ?? '',
      bank_account_number: employee.bank_account_number ?? '',
      bank_name: employee.bank_name ?? '',
      payment_notes: employee.payment_notes ?? '',
      offered_service_ids: [...(employee.offered_service_ids ?? [])],
    });
    setShowPinInForm(false);
    setStaffModalOpen(true);
    if (staffPhotoInputRef.current) staffPhotoInputRef.current.value = '';
  };

  // Deep link from notifications: ?staff=id (legacy ?employee=id)
  useEffect(() => {
    if (isEmployeeSelfService) return;
    const staffIdParam = searchParams.get('staff') ?? searchParams.get('employee');
    if (!staffIdParam || employees.length === 0) return;
    const next = new URLSearchParams(searchParams);
    next.delete('staff');
    next.delete('employee');
    setSearchParams(next, { replace: true });
    const emp = employees.find((e) => e.id === staffId);
    if (!emp) return;
    handleEdit(emp);
  }, [searchParams, employees, setSearchParams]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const handleViewTimesheet = (staffRowId: string) => {
    if (businessSlug) {
      navigate(`/${businessSlug}/reports/payroll/staff/${staffRowId}/timesheet`);
    } else {
      navigate(`/reports/payroll/staff/${staffRowId}/timesheet`);
    }
  };

  const handleSaveNewJobTitle = async () => {
    const r = await addTitle(newJobTitleInput);
    if (r.error === 'empty') {
      toast.error(t('employeeManagement.jobTitleEmpty'));
      return;
    }
    if (r.error === 'duplicate') {
      toast.error(t('employeeManagement.jobTitleDuplicate'));
      return;
    }
    if (r.error === 'other') {
      toast.error(r.message ?? t('common.genericError'));
      return;
    }
    if (r.row) {
      setFormData((fd) => ({ ...fd, job_title_id: r.row!.id }));
      setJobTitleDialogOpen(false);
      setNewJobTitleInput('');
    }
  };

  const handleCancel = () => {
    closeStaffModal();
  };

  const togglePinVisibility = (id: string) => {
    setShowPin(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteClick = (id: string) => {
    setEmployeeToDelete(id);
    const emp = employees.find((e) => e.id === id);
    const pref =
      emp?.last_date != null && String(emp.last_date).length > 0
        ? new Date(emp.last_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
    setRemoveLastWorkingDate(pref);
    setDeleteDialogOpen(true);
  };

  const handleReactivateClick = (id: string) => {
    setEmployeeToReactivate(id);
    const emp = employees.find((e) => e.id === id);
    const pref =
      emp?.hire_date != null && String(emp.hire_date).length > 0
        ? new Date(emp.hire_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
    setReactivateStartDate(pref);
    setReactivateDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!employeeToDelete || !removeLastWorkingDate) return;
    if (!parseYmdLocal(removeLastWorkingDate)) return;
    const lastIso = localYmdToTimestamptzIso(removeLastWorkingDate);
    if (!lastIso) return;
    const removedId = employeeToDelete;
    const closeEditor = removedId === editingEmployee?.id;
    await onUpdateEmployee(removedId, {
      status: 'inactive',
      last_date: lastIso,
    });
    setEmployeeToDelete(null);
    setRemoveLastWorkingDate('');
    setDeleteDialogOpen(false);
    if (closeEditor) closeStaffModal();
  };

  const handleConfirmReactivate = async () => {
    if (!employeeToReactivate || !reactivateStartDate) return;
    if (!parseYmdLocal(reactivateStartDate)) return;
    const hireIso = localYmdToTimestamptzIso(reactivateStartDate);
    if (!hireIso) return;
    const reactivatedId = employeeToReactivate;
    await onUpdateEmployee(reactivatedId, {
      status: 'active',
      hire_date: hireIso,
      last_date: null as any,
    });
    setEmployeeToReactivate(null);
    setReactivateStartDate('');
    setReactivateDialogOpen(false);
  };

  const { language: lang } = useLanguage();
  const todayLocal = atLocalDay(new Date());
  const dobInputBounds = employeeDobInputBounds();

  const modalEmployeeLive = editingEmployee
    ? employees.find((e) => e.id === editingEmployee.id) ?? editingEmployee
    : null;

  const handlePinReset = async (employeeId: string) => {
    if (!businessId) return;

    if (!confirm('Are you sure you want to reset this employee\'s PIN? They will need to set a new PIN before clocking in.')) {
      return;
    }

    if (demoBrowseOnly) {
      await onUpdateEmployee(employeeId, {
        pin: '',
        pin_set_at: undefined,
        pin_required: true,
      } as any);
      return;
    }

    try {
      const { error } = await supabase
        .from('staff')
        .update({
          pin: '',
          pin_set_at: null,
          pin_required: true,
        })
        .eq('id', employeeId);

      if (error) {
        alert('Failed to reset PIN. Please try again.');
      } else {
        // Refresh employee data - pass the updated fields explicitly
        await onUpdateEmployee(employeeId, {
          pin: '',
          pin_set_at: undefined,
          pin_required: true,
        } as any);
      }
    } catch (err) {
      alert('Failed to reset PIN. Please try again.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-medium">Could not load staff</p>
          <p className="mt-1 text-destructive/90">{loadError}</p>
          {onRetryLoad && (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onRetryLoad()}>
              Try again
            </Button>
          )}
        </div>
      ) : null}

      {!isEmployeeSelfService && !demoBrowseOnly && jobTitlesSchemaUnavailable ? (
        <Alert variant="warning" className="mb-4 shrink-0">
          <AlertTitle>{t('employeeManagement.jobTitlesSchemaAlertTitle')}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t('employeeManagement.jobTitlesSchemaAlertBody1')}</p>
            <pre className="max-w-full overflow-x-auto rounded-md border border-border bg-muted/80 px-3 py-2 text-xs font-mono text-foreground">
              {t('employeeManagement.jobTitlesSchemaAlertCodePush')}
            </pre>
            <p>{t('employeeManagement.jobTitlesSchemaAlertBody2')}</p>
            <p>{t('employeeManagement.jobTitlesSchemaAlertBody3')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetchJobTitles()}>
              {t('common.tryAgain')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isEmployeeSelfService && loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}
      {isEmployeeSelfService && !loading && !loadError && staffId && listForGrid.length > 0 ? (
        <EmployeeSelfReadOnlyProfile
          employee={listForGrid[0]}
          lang={lang}
          todayLocal={todayLocal}
          onEdit={listForGrid[0].status === 'active' ? () => handleEdit(listForGrid[0]) : undefined}
          onManageServices={listForGrid[0].status === 'active' ? openEmployeeServicesDialog : undefined}
          catalogServices={catalogServices}
        />
      ) : null}

      {isEmployeeSelfService ? (
        <Dialog open={servicesOnlyDialogOpen} onOpenChange={setServicesOnlyDialogOpen}>
          <DialogContent className="max-h-[min(90vh,640px)] max-w-lg overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{t('employeeManagement.addServicesDialogTitle')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t('employeeManagement.servicesOfferedHint')}</p>
            <OfferedServicesPickGrid
              catalogServices={staffFormCatalogServices}
              selectedIds={servicesOnlyDraftIds}
              onToggleId={(id) =>
                setServicesOnlyDraftIds((cur) =>
                  cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
                )
              }
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setServicesOnlyDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={() => void saveEmployeeServicesDialog()}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {!isEmployeeSelfService ? (
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap"
          data-page-toolbar
          data-page-search
        >
          <SearchFilter
            searchTerm={staffSearchTerm}
            onSearchChange={setStaffSearchTerm}
            placeholder={t('employeeManagement.searchPlaceholder')}
          />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {t('employeeManagement.statusFilter')}
            </span>
            <Select value={statusFilter} onValueChange={(v: 'active' | 'inactive') => setStatusFilter(v)}>
              <SelectTrigger
                id="employee-status-filter"
                className="h-10 w-[min(100vw-10rem,260px)] rounded-xl border border-input bg-background/80 backdrop-blur-sm dark:bg-background/40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('employeeManagement.filterActive')}</SelectItem>
                <SelectItem value="inactive">{t('employeeManagement.filterInactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="inline-flex rounded-xl border border-input bg-background/80 backdrop-blur-sm p-0.5 shrink-0">
            <button
              type="button"
              className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
                viewMode === 'cards' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setViewMode('cards')}
              aria-label="Card view"
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
            </button>
            <button
              type="button"
              className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
                viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="w-4 h-4 shrink-0" />
            </button>
          </div>
          <Button
            type="button"
            onClick={() => {
              if (staffModalOpen) {
                closeStaffModal();
                return;
              }
              setEditingEmployee(null);
              resetForm();
              setStaffModalOpen(true);
            }}
            className="flex shrink-0 items-center gap-2 shadow-sm"
          >
            {staffModalOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {staffModalOpen ? t('common.cancel') : t('employeeManagement.addEmployee')}
          </Button>
        </div>
      ) : null}

      <Dialog open={staffModalOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="flex h-[min(92vh,900px)] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <div className="shrink-0 space-y-3 border-b border-border px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-end gap-2 pr-8 sm:pr-10">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
              <DetailModalActionBar
                className="border-0 pb-0"
                variant="save-delete"
                submitFormId="staff-editor-form"
                saveLabel={t('common.save')}
                disabledSave={staffPhotoUploading}
                deleteLabel={t('employeeManagement.deleteEmployee')}
                onDelete={
                  !isEmployeeSelfService &&
                  editingEmployee &&
                  modalEmployeeLive?.status === 'active'
                    ? () => handleDeleteClick(editingEmployee.id)
                    : undefined
                }
                onAux={
                  !isEmployeeSelfService &&
                  editingEmployee &&
                  modalEmployeeLive?.status === 'inactive'
                    ? () => handleReactivateClick(editingEmployee.id)
                    : undefined
                }
                auxLabel={t('employeeManagement.reactivateEmployee')}
                auxIcon={<RotateCcw className="h-4 w-4 shrink-0" />}
              />
            </div>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl font-semibold">
                {isEmployeeSelfService && editingEmployee
                  ? t('nav.myStaffProfile')
                  : editingEmployee
                    ? t('employeeManagement.editEmployee')
                    : t('employeeManagement.addNewEmployee')}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <form id="staff-editor-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('employeeManagement.profilePhoto')}</Label>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                      {formData.photo_url ? (
                        <img src={formData.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={staffPhotoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleStaffPhotoFile}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => staffPhotoInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {t('employeeManagement.profilePhoto')}
                      </Button>
                      {formData.photo_url ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setFormData({ ...formData, photo_url: null });
                            if (staffPhotoInputRef.current) staffPhotoInputRef.current.value = '';
                          }}
                        >
                          {t('employeeManagement.removePhoto')}
                        </Button>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{t('employeeManagement.profilePhotoHint')}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('employeeManagement.firstName')}</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                      autoComplete="given-name"
                      placeholder="Jane"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('employeeManagement.lastName')}</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      autoComplete="family-name"
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@example.com"
                  />
                  <p className="text-xs text-muted-foreground">{t('employeeManagement.emailOptionalHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    required
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('employeeManagement.pinLabel')}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPinInForm(!showPinInForm)}
                      className="h-6 text-xs"
                    >
                      {showPinInForm ? (
                        <>
                          <EyeOff className="mr-1 h-3 w-3" /> Hide
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1 h-3 w-3" /> Show
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Input
                      readOnly
                      className="font-mono tracking-widest sm:min-w-[8rem] sm:flex-1"
                      value={
                        !formData.pin
                          ? ''
                          : showPinInForm || !editingEmployee
                            ? formData.pin
                            : '•'.repeat(EMPLOYEE_PIN_LENGTH)
                      }
                      placeholder="…"
                      aria-label={t('employeeManagement.pinLabel')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void handleGenerateFormPin()}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('employeeManagement.generatePin')}
                    </Button>
                    {editingEmployee && modalEmployeeLive?.pin_set_at && !isEmployeeSelfService ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs text-muted-foreground"
                        onClick={() => void handlePinReset(modalEmployeeLive.id)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Reset PIN
                      </Button>
                    ) : null}
                  </div>
                  {editingEmployee && modalEmployeeLive?.pin_set_at ? (
                    <p className="text-xs text-muted-foreground">
                      PIN set {new Date(modalEmployeeLive.pin_set_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                {!isEmployeeSelfService ? (
                  <>
                    <div className="space-y-2">
                      <Label>{t('employeeManagement.compensationType')}</Label>
                      <Select
                        value={formData.compensation_type}
                        onValueChange={(value: 'hourly' | 'commission') =>
                          setFormData({ ...formData, compensation_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">{t('employeeManagement.compensationHourly')}</SelectItem>
                          <SelectItem value="commission">{t('employeeManagement.compensationCommission')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Hourly Rate ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.50"
                        value={formData.hourly_rate}
                        onChange={(e) => setFormData({ ...formData, hourly_rate: Number(e.target.value) })}
                        required={formData.compensation_type === 'hourly'}
                        disabled={formData.compensation_type === 'commission'}
                      />
                    </div>
                    {formData.compensation_type === 'commission' && (
                      <div className="space-y-2">
                        <Label>{t('employeeManagement.commissionRate')}</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={formData.commission_rate === '' ? '' : formData.commission_rate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              commission_rate: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                    )}
                  </>
                ) : null}
                <div className="space-y-2">
                  <Label>{t('employeeManagement.jobTitle')}</Label>
                  {isEmployeeSelfService ? (
                    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
                      {formatJobTitleForBadge(editingEmployee?.role ?? '')}
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={formData.job_title_id || undefined}
                          onValueChange={(v) => setFormData({ ...formData, job_title_id: v })}
                        >
                          <SelectTrigger className="min-w-[12rem] flex-1 sm:max-w-md">
                            <SelectValue placeholder={t('employeeManagement.selectJobTitle')} />
                          </SelectTrigger>
                          <SelectContent>
                            {jobTitles.map((jt) => (
                              <SelectItem key={jt.id} value={jt.id}>
                                {jt.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="default"
                          className="shrink-0"
                          onClick={() => {
                            setNewJobTitleInput('');
                            setJobTitleDialogOpen(true);
                          }}
                        >
                          {t('employeeManagement.addJobTitle')}
                        </Button>
                      </div>
                      {jobTitlesSchemaUnavailable ? (
                        <p className="text-xs text-muted-foreground">{t('employeeManagement.jobTitlesSchemaErrorShort')}</p>
                      ) : jobTitles.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t('employeeManagement.noJobTitlesYet')}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t('employeeManagement.accessRoleLabel')}</Label>
                  {canEditStaffAccessRoles ? (
                    <Select
                      value={formData.access_role}
                      onValueChange={(value: StaffAccessRole) =>
                        setFormData({ ...formData, access_role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!canAssignAdminAccessRole && formData.access_role === 'admin' ? (
                          <SelectItem value="admin" disabled>
                            {t('employeeManagement.accessRoleCurrentAdmin')}
                          </SelectItem>
                        ) : null}
                        <SelectItem value="manager">{t('employeeManagement.accessRoleManager')}</SelectItem>
                        <SelectItem value="staff">{t('employeeManagement.accessRoleStaff')}</SelectItem>
                        <SelectItem value="contractor">{t('employeeManagement.accessRoleContractor')}</SelectItem>
                        {canAssignAdminAccessRole ? (
                          <SelectItem value="admin">{t('employeeManagement.accessRoleAdmin')}</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-foreground">
                      {formData.access_role === 'admin'
                        ? t('employeeManagement.accessRoleAdmin')
                        : formData.access_role === 'manager'
                          ? t('employeeManagement.accessRoleManager')
                          : formData.access_role === 'contractor'
                            ? t('employeeManagement.accessRoleContractor')
                            : t('employeeManagement.accessRoleStaff')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {canEditStaffAccessRoles
                      ? t('employeeManagement.accessRoleHint')
                      : t('employeeManagement.accessRoleReadOnlyHint')}
                  </p>
                </div>
                {!isEmployeeSelfService ? (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'active' | 'inactive') =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-3 md:col-span-2">
                  <div>
                    <Label className="text-base">{t('employeeManagement.servicesOfferedTitle')}</Label>
                    <p className="text-xs text-muted-foreground">{t('employeeManagement.servicesOfferedHint')}</p>
                  </div>
                  <OfferedServicesPickGrid
                    catalogServices={staffFormCatalogServices}
                    selectedIds={formData.offered_service_ids}
                    onToggleId={(id) =>
                      setFormData((fd) => {
                        const cur = fd.offered_service_ids;
                        const has = cur.includes(id);
                        return {
                          ...fd,
                          offered_service_ids: has ? cur.filter((x) => x !== id) : [...cur, id],
                        };
                      })
                    }
                  />
                </div>
                <div className="space-y-4 rounded-lg border border-border p-4 md:col-span-2">
                  <p className="text-sm font-medium text-foreground">{t('employeeManagement.paymentSection')}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t('employeeManagement.routingNumber')}</Label>
                      <Select
                        value={
                          PUERTO_RICO_BANK_ROUTING.some((b) => b.routing === formData.bank_routing_number)
                            ? formData.bank_routing_number
                            : '__custom'
                        }
                        onValueChange={(v) => {
                          if (v === '__custom') {
                            setFormData((fd) => ({ ...fd, bank_routing_number: '', bank_name: '' }));
                          } else {
                            const b = PUERTO_RICO_BANK_ROUTING.find((x) => x.routing === v);
                            if (b) {
                              setFormData((fd) => ({
                                ...fd,
                                bank_routing_number: b.routing,
                                bank_name: b.name,
                              }));
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('employeeManagement.routingNumber')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__custom">{t('employeeManagement.routingCustom')}</SelectItem>
                          {PUERTO_RICO_BANK_ROUTING.map((b) => (
                            <SelectItem key={b.routing} value={b.routing}>
                              {b.name} — {b.routing}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs text-muted-foreground">
                        {t('employeeManagement.routingNumberManual')}
                      </Label>
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        value={formData.bank_routing_number}
                        onChange={(e) => {
                          const digits = normalizeRoutingDigits(e.target.value);
                          const match = findPuertoRicoBankByRouting(digits);
                          setFormData((fd) => ({
                            ...fd,
                            bank_routing_number: digits,
                            bank_name: match ? match.name : fd.bank_name,
                          }));
                        }}
                        onBlur={() => {
                          const match = findPuertoRicoBankByRouting(
                            normalizeRoutingDigits(formData.bank_routing_number)
                          );
                          if (match) {
                            setFormData((fd) => ({ ...fd, bank_name: match.name }));
                          }
                        }}
                        placeholder="021502011"
                        maxLength={11}
                      />
                      {findPuertoRicoBankByRouting(normalizeRoutingDigits(formData.bank_routing_number)) ? (
                        <p className="text-xs text-muted-foreground">
                          {t('employeeManagement.routingMatched')}:{' '}
                          {
                            findPuertoRicoBankByRouting(
                              normalizeRoutingDigits(formData.bank_routing_number)
                            )?.name
                          }
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label>{t('employeeManagement.bankName')}</Label>
                      <Input
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder="Banco Popular"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('employeeManagement.accountNumber')}</Label>
                      <Input
                        value={formData.bank_account_number}
                        onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                        autoComplete="off"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t('employeeManagement.paymentNotes')}</Label>
                      <Input
                        value={formData.payment_notes}
                        onChange={(e) => setFormData({ ...formData, payment_notes: e.target.value })}
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <Label>{t('employeeManagement.dateOfBirthLabel')}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFormData({ ...formData, dob_date: '' })}
                    >
                      {t('employeeManagement.dobClear')}
                    </Button>
                  </div>
                  <Input
                    type="date"
                    min={dobInputBounds.min}
                    max={dobInputBounds.max}
                    value={formData.dob_date}
                    onChange={(e) => setFormData({ ...formData, dob_date: e.target.value })}
                    className="max-w-xs"
                  />
                </div>
                {!isEmployeeSelfService ? (
                  <>
                    <div className="space-y-2">
                      <Label>Hire Date</Label>
                      <Input
                        type="date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      />
                    </div>
                    {formData.status === 'inactive' && (
                      <div className="space-y-2">
                        <Label>Last Date (Termination/End Date)</Label>
                        <Input
                          type="date"
                          value={formData.last_date}
                          onChange={(e) => setFormData({ ...formData, last_date: e.target.value })}
                        />
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {modalEmployeeLive ? (
                <div className="mt-6 space-y-3 border-t border-border pt-4">
                  {modalEmployeeLive.status === 'active' && modalEmployeeLive.hire_date ? (
                    <div className="rounded-md border border-border bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
                      {t('employeeManagement.tenureToDate', {
                        tenure: (() => {
                          const { y, m, d } = calendarDiffYMD(
                            atLocalDay(modalEmployeeLive.hire_date!),
                            todayLocal
                          );
                          return formatTenureYMD(y, m, d, lang);
                        })(),
                      })}
                    </div>
                  ) : null}
                  {modalEmployeeLive.status === 'inactive' &&
                  modalEmployeeLive.hire_date &&
                  modalEmployeeLive.last_date ? (
                    <div className="rounded-md border border-border bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
                      {t('employeeManagement.timeWithCompany', {
                        tenure: (() => {
                          const { y, m, d } = calendarDiffYMD(
                            atLocalDay(modalEmployeeLive.hire_date!),
                            atLocalDay(modalEmployeeLive.last_date!)
                          );
                          return formatTenureYMD(y, m, d, lang);
                        })(),
                      })}
                    </div>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="flex w-full items-center gap-2 sm:w-auto"
                    onClick={() => handleViewTimesheet(modalEmployeeLive.id)}
                  >
                    <Clock className="h-4 w-4" />
                    {t('timesheet.title')}
                  </Button>
                </div>
              ) : null}
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {!isEmployeeSelfService && staffDirectoryList.length > 0 ? (
        viewMode === 'cards' ? (
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            data-page-content
            data-page-cards-grid
          >
            {staffDirectoryList.map((employee) => (
              <Card key={employee.id}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={() => handleEdit(employee)}
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                      {employee.photo_url ? (
                        <img src={employee.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <UserRound className="h-7 w-7" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{employeeFullName(employee)}</h3>
                        {employee.user_id ? (
                          <span className="rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:text-green-400">
                            {t('employeeManagement.accountActive')}
                          </span>
                        ) : pendingInviteStaffIds.has(employee.id) ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                            {t('employeeManagement.invitationPending')}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {formatJobTitleForBadge(employee.role)}
                      </p>
                      <p className="break-all text-sm text-muted-foreground">{employee.email}</p>
                      <p className="text-sm text-muted-foreground">{formatPhoneNumber(employee.phone)}</p>
                    </div>
                  </button>
                  {canSendPortalInvite && !isEmployeeSelfService && employee.status === 'active' ? (
                    <div
                      className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                    {!employee.user_id ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="text-xs shadow-sm"
                        onClick={() => {
                          setInviteTarget(employee);
                          setInviteDialogOpen(true);
                        }}
                      >
                        {t('employeeManagement.sendPortalInvite')}
                      </Button>
                    ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border-0 bg-card" data-page-content data-table-load>
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-14" aria-hidden />
                  <th className="text-left px-3 py-2 font-medium">{t('pets.listName')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('form.email')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('form.phone')}</th>
                  <th className="text-left px-3 py-2 font-medium w-[140px]">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {staffDirectoryList.map((employee) => (
                  <tr key={employee.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2 align-middle">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-border bg-muted">
                        {employee.photo_url ? (
                          <img src={employee.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <UserRound className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{employeeFullName(employee)}</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {formatJobTitleForBadge(employee.role)}
                        </span>
                        {employee.user_id ? (
                          <span className="w-fit rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:text-green-400">
                            {t('employeeManagement.accountActive')}
                          </span>
                        ) : pendingInviteStaffIds.has(employee.id) ? (
                          <span className="w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                            {t('employeeManagement.invitationPending')}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-muted-foreground break-all max-w-[200px]">
                      {employee.email || '—'}
                    </td>
                    <td className="px-3 py-2 align-middle text-muted-foreground whitespace-nowrap">
                      {formatPhoneNumber(employee.phone)}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(employee)}
                          aria-label={t('employeeManagement.editEmployee')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canSendPortalInvite && employee.status === 'active' && !employee.user_id ? (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-8 text-xs shadow-sm"
                            onClick={() => {
                              setInviteTarget(employee);
                              setInviteDialogOpen(true);
                            }}
                          >
                            {t('employeeManagement.invitePortalShort')}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : !isEmployeeSelfService && !loading && !loadError && employees.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <p>No staff members returned for this business.</p>
            <p className="mt-3 text-left leading-relaxed">
              If people already exist in Supabase, check that each row&apos;s <code className="rounded bg-muted px-1">business_id</code>{' '}
              matches your account&apos;s business (same UUID as in <code className="rounded bg-muted px-1">profiles.business_id</code>
              ). Row Level Security only shows staff for your profile&apos;s business.
            </p>
          </CardContent>
        </Card>
      ) : !loading && !loadError && !isEmployeeSelfService && filteredEmployees.length === 0 && employees.length > 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          No {statusFilter} staff match this filter.
        </p>
      ) : !loading && !loadError && !isEmployeeSelfService && filteredEmployees.length > 0 && staffDirectoryList.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('employeeManagement.noSearchResults')}</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !loadError && isEmployeeSelfService && staffId && listForGrid.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('employeeManagement.selfServiceProfileMissing')}
          </CardContent>
        </Card>
      ) : null}

      {!isEmployeeSelfService && employees.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('employeeManagement.noEmployeesYet')}</p>
          </CardContent>
        </Card>
      ) : !isEmployeeSelfService && filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {statusFilter === 'inactive'
                ? t('employeeManagement.noInactiveEmployees')
                : t('employeeManagement.noActiveEmployees')}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!isEmployeeSelfService ? (
      <>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setEmployeeToDelete(null);
            setRemoveLastWorkingDate('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('employeeManagement.removeEmployeeDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>{t('employeeManagement.removeEmployeeDialogIntro')}</p>
            <div className="space-y-2">
              <Label htmlFor="remove-last-working-date">{t('employeeManagement.removeLastWorkingDateLabel')}</Label>
              <Input
                id="remove-last-working-date"
                type="date"
                value={removeLastWorkingDate}
                onChange={(e) => setRemoveLastWorkingDate(e.target.value)}
                className="max-w-[14rem]"
              />
            </div>
            {(() => {
              const parsed = parseYmdLocal(removeLastWorkingDate);
              const today = atLocalDay(new Date());
              if (!parsed || parsed.getTime() <= today.getTime()) return null;
              return (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
                  {t('employeeManagement.removeFutureInactiveWarning')}
                </p>
              );
            })()}
            {(() => {
              const parsed = parseYmdLocal(removeLastWorkingDate);
              const today = atLocalDay(new Date());
              if (!parsed || parsed.getTime() > today.getTime()) return null;
              return (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
                  {t('employeeManagement.removePastInactiveNote')}
                </p>
              );
            })()}
            <p className="text-xs">{t('employeeManagement.removeNoPermanentDeletionNote')}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!parseYmdLocal(removeLastWorkingDate)}
              onClick={() => void handleConfirmRemove()}
            >
              {t('employeeManagement.removeConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reactivateDialogOpen}
        onOpenChange={(open) => {
          setReactivateDialogOpen(open);
          if (!open) {
            setEmployeeToReactivate(null);
            setReactivateStartDate('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('employeeManagement.reactivateEmployeeDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>{t('employeeManagement.reactivateEmployeeDialogIntro')}</p>
            <div className="space-y-2">
              <Label htmlFor="reactivate-start-date">{t('employeeManagement.reactivateStartDateLabel')}</Label>
              <Input
                id="reactivate-start-date"
                type="date"
                value={reactivateStartDate}
                onChange={(e) => setReactivateStartDate(e.target.value)}
                className="max-w-[14rem]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setReactivateDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!parseYmdLocal(reactivateStartDate)}
              onClick={() => void handleConfirmReactivate()}
            >
              {t('employeeManagement.reactivateConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      ) : null}

      <Dialog open={jobTitleDialogOpen} onOpenChange={setJobTitleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('employeeManagement.addJobTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-job-title">{t('employeeManagement.jobTitle')}</Label>
            <Input
              id="new-job-title"
              value={newJobTitleInput}
              onChange={(e) => setNewJobTitleInput(e.target.value)}
              placeholder={t('employeeManagement.newJobTitlePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSaveNewJobTitle();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setJobTitleDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void handleSaveNewJobTitle()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isEmployeeSelfService ? (
        <InviteEmployeeDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          staffMember={inviteTarget}
          businessId={businessId}
          businessName={business?.name ?? null}
          isSuperAdmin={isSuperAdmin}
          onSent={() => void refreshPendingInvites()}
        />
      ) : null}

    </div>
  );
}
