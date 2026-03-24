import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Eye, EyeOff, Users, Clock, Lock, RotateCcw, RefreshCw, X, Upload, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DetailModalActionBar } from '@/components/DetailModalActionBar';
import { Badge } from '@/components/ui/badge';
import { Employee, StaffAccessRole } from '@/types';
import { EmployeePinSetupDialog } from '@/components/EmployeePinSetupDialog';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { t, getLanguage } from '@/lib/translations';
import { dayOptions, isValidEmployeeDob, monthOptions, yearOptions } from '@/lib/employeeDob';
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
import { dispatchStaffBirthdaysForBusiness } from '@/lib/staffBirthdayDispatch';

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

/** Job title (groomer, Manager, …) next to name; color hints at access tier. */
function JobTitleBadge({ employee }: { employee: Employee }) {
  const tier: StaffAccessRole = resolvedAccessRole(employee);
  const label = formatJobTitleForBadge(employee.role).toUpperCase();
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
  const demoBrowseOnly = useDemoBrowseOnly();
  const [searchParams, setSearchParams] = useSearchParams();
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPin, setShowPin] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [removeLastWorkingDate, setRemoveLastWorkingDate] = useState('');
  const [pinSetupDialogOpen, setPinSetupDialogOpen] = useState(false);
  const [employeeForPinSetup, setEmployeeForPinSetup] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    pin: '',
    hourly_rate: 15,
    role: 'groomer',
    status: 'active' as 'active' | 'inactive',
    hire_date: '',
    last_date: '',
    birth_month: '',
    birth_day: '',
    birth_year: '',
    photo_url: null as string | null,
    compensation_type: 'hourly' as 'hourly' | 'commission',
    commission_rate: '' as number | '',
    bank_routing_number: '',
    bank_account_number: '',
    bank_name: '',
    payment_notes: '',
  });
  const [originalStaffPhotoUrl, setOriginalStaffPhotoUrl] = useState<string | null>(null);
  const [staffPhotoUploading, setStaffPhotoUploading] = useState(false);
  const staffPhotoInputRef = useRef<HTMLInputElement>(null);
  const [showPinInForm, setShowPinInForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.status === statusFilter),
    [employees, statusFilter]
  );

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
      name: '',
      email: '',
      phone: '',
      pin: '',
      hourly_rate: 15,
      role: 'groomer',
      status: 'active',
      hire_date: '',
      last_date: '',
      birth_month: '',
      birth_day: '',
      birth_year: '',
      photo_url: null,
      compensation_type: 'hourly',
      commission_rate: '',
      bank_routing_number: '',
      bank_account_number: '',
      bank_name: '',
      payment_notes: '',
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

    const hireIso = formData.hire_date ? localYmdToTimestamptzIso(formData.hire_date) : null;
    const lastIso =
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

    const dm = String(formData.birth_month ?? '').trim();
    const dd = String(formData.birth_day ?? '').trim();
    const dy = String(formData.birth_year ?? '').trim();
    const anyDob = dm || dd || dy;
    const allDob = dm && dd && dy;
    if (anyDob && !allDob) {
      alert(t('employeeManagement.dobIncomplete'));
      return;
    }
    let birth_month: number | null = null;
    let birth_day: number | null = null;
    let birth_year: number | null = null;
    if (allDob) {
      const month = parseInt(dm, 10);
      const day = parseInt(dd, 10);
      const year = parseInt(dy, 10);
      if (!isValidEmployeeDob(day, month, year)) {
        alert(t('employeeManagement.dobInvalid'));
        return;
      }
      birth_month = month;
      birth_day = day;
      birth_year = year;
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

    const commission_rate =
      formData.compensation_type === 'commission' && formData.commission_rate !== ''
        ? Number(formData.commission_rate)
        : null;

    const submitData: Record<string, unknown> = {
      name: formData.name.trim(),
      email: emailTrim,
      phone: unformatPhoneNumber(formData.phone),
      pin: formData.pin,
      hourly_rate: Number(formData.hourly_rate),
      role: formData.role,
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
    };

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
        toast.error(t('employeeManagement.saveStaffFailed'));
        return;
      }
    } else {
      if (submitData.pin && String(submitData.pin).length === EMPLOYEE_PIN_LENGTH) {
        submitData.pin_set_at = new Date().toISOString();
        submitData.pin_required = false;
      }
      const created = await onAddEmployee(submitData as Omit<Employee, 'id' | 'created_at' | 'updated_at'>);
      if (created == null) {
        toast.error(t('employeeManagement.saveStaffFailed'));
        return;
      }
    }
    // Let the RPC decide "today" using business timezone (settings). Client local date often mismatched.
    if (allDob && birth_month !== null && birth_day !== null && !demoBrowseOnly) {
      const { error: bdayErr } = await dispatchStaffBirthdaysForBusiness(businessId);
      if (bdayErr) toast.error(bdayErr);
      else if (isDemoWorkspaceBusiness(businessId)) clearPetHubBirthdayJobLocalKey(businessId);
    }
    closeStaffModal();
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setOriginalStaffPhotoUrl(employee.photo_url ?? null);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: formatPhoneNumber(employee.phone),
      pin: employee.pin,
      hourly_rate: employee.hourly_rate,
      role: employee.role,
      status: employee.status,
      hire_date: timestamptzToDateInputValue(employee.hire_date),
      last_date: timestamptzToDateInputValue(employee.last_date),
      birth_month: employee.birth_month != null ? String(employee.birth_month) : '',
      birth_day: employee.birth_day != null ? String(employee.birth_day) : '',
      birth_year: employee.birth_year != null ? String(employee.birth_year) : '',
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
    });
    setShowPinInForm(false);
    setStaffModalOpen(true);
    if (staffPhotoInputRef.current) staffPhotoInputRef.current.value = '';
  };

  // Deep link from notifications: ?staff=id (legacy ?employee=id)
  useEffect(() => {
    const staffId = searchParams.get('staff') ?? searchParams.get('employee');
    if (!staffId || employees.length === 0) return;
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

  const handlePinSetup = (employee: Employee) => {
    setEmployeeForPinSetup(employee);
    setPinSetupDialogOpen(true);
  };

  const lang = getLanguage();
  const todayLocal = atLocalDay(new Date());
  const monthChoices = useMemo(() => monthOptions(lang), [lang]);
  const yearChoices = useMemo(() => yearOptions(), []);
  const birthYearNum = parseInt(formData.birth_year, 10);
  const birthMonthNum = parseInt(formData.birth_month, 10);
  const yForDays = Number.isFinite(birthYearNum) ? birthYearNum : 2000;
  const mForDays =
    Number.isFinite(birthMonthNum) && birthMonthNum >= 1 && birthMonthNum <= 12 ? birthMonthNum : 1;
  const dayChoices = useMemo(() => dayOptions(mForDays, yForDays), [mForDays, yForDays]);

  const modalEmployeeLive = editingEmployee
    ? employees.find((e) => e.id === editingEmployee.id) ?? editingEmployee
    : null;

  const clampBirthDay = (month: number, year: number, dayStr: string) => {
    const dim = dayOptions(month, year).length;
    const d = parseInt(dayStr, 10);
    if (!Number.isFinite(d)) return '';
    return String(Math.min(Math.max(1, d), dim));
  };

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

  const handlePinSetupSuccess = () => {
    if (employeeForPinSetup) {
      onUpdateEmployee(employeeForPinSetup.id, {});
    }
    setEmployeeForPinSetup(null);
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

      <div
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        data-page-toolbar
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:min-w-[200px]">
          <span className="whitespace-nowrap text-sm text-muted-foreground">
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
                  editingEmployee ? () => handleDeleteClick(editingEmployee.id) : undefined
                }
              />
            </div>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl font-semibold">
                {editingEmployee
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
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Jane Smith"
                  />
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      className="font-mono tracking-widest sm:flex-1"
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
                  </div>
                </div>
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
                <div className="space-y-2">
                  <Label>{t('employeeManagement.jobTitle')}</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="groomer">Groomer</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="receptionist">Receptionist</SelectItem>
                      <SelectItem value="bather">Bather</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                      onClick={() =>
                        setFormData({ ...formData, birth_month: '', birth_day: '', birth_year: '' })
                      }
                    >
                      {t('employeeManagement.dobClear')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('employeeManagement.dobMonth')}</Label>
                      <Select
                        value={formData.birth_month || undefined}
                        onValueChange={(v) => {
                          const month = parseInt(v, 10);
                          const y = parseInt(formData.birth_year, 10) || 2000;
                          const nextDay = formData.birth_day
                            ? clampBirthDay(month, y, formData.birth_day)
                            : formData.birth_day;
                          setFormData({ ...formData, birth_month: v, birth_day: nextDay });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('employeeManagement.dobPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {monthChoices.map((mo) => (
                            <SelectItem key={mo.value} value={String(mo.value)}>
                              {mo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('employeeManagement.dobDay')}</Label>
                      <Select
                        value={formData.birth_day || undefined}
                        onValueChange={(v) => setFormData({ ...formData, birth_day: v })}
                        disabled={!formData.birth_month}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('employeeManagement.dobPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {dayChoices.map((d) => (
                            <SelectItem key={d} value={String(d)}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('employeeManagement.dobYear')}</Label>
                      <Select
                        value={formData.birth_year || undefined}
                        onValueChange={(v) => {
                          const year = parseInt(v, 10);
                          const month = parseInt(formData.birth_month, 10) || 1;
                          const nextDay = formData.birth_day
                            ? clampBirthDay(month, year, formData.birth_day)
                            : formData.birth_day;
                          setFormData({ ...formData, birth_year: v, birth_day: nextDay });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('employeeManagement.dobPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {yearChoices.map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
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
                  <div className="flex flex-wrap items-center gap-2">
                    {modalEmployeeLive.pin_set_at ? (
                      <Badge variant="outline" className="text-xs">
                        PIN set {new Date(modalEmployeeLive.pin_set_at).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        className="text-xs"
                        onClick={() => handlePinSetup(modalEmployeeLive)}
                      >
                        <Lock className="mr-1 h-3 w-3" />
                        Set PIN
                      </Button>
                    )}
                    {modalEmployeeLive.pin_set_at ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="text-xs text-muted-foreground"
                        onClick={() => handlePinReset(modalEmployeeLive.id)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Reset PIN
                      </Button>
                    ) : null}
                  </div>
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

      {filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee) => (
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
                      <h3 className="text-lg font-semibold">{employee.name}</h3>
                      <JobTitleBadge employee={employee} />
                    </div>
                    <p className="break-all text-sm text-muted-foreground">{employee.email}</p>
                    <p className="text-sm text-muted-foreground">{formatPhoneNumber(employee.phone)}</p>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !loading && !loadError && employees.length === 0 ? (
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
      ) : !loading && !loadError && employees.length > 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          No {statusFilter} staff match this filter.
        </p>
      ) : null}

      {employees.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('employeeManagement.noEmployeesYet')}</p>
          </CardContent>
        </Card>
      ) : filteredEmployees.length === 0 ? (
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

      {employeeForPinSetup && (
        <EmployeePinSetupDialog
          open={pinSetupDialogOpen}
          onOpenChange={setPinSetupDialogOpen}
          employeeId={employeeForPinSetup.id}
          employeeName={employeeForPinSetup.name}
          onSuccess={handlePinSetupSuccess}
        />
      )}
    </div>
  );
}
