import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, EyeOff, Users, Clock, Lock, RotateCcw, RefreshCw, X } from 'lucide-react';
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
  const [showAddForm, setShowAddForm] = useState(false);
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
  });
  const [showPinInForm, setShowPinInForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.status === statusFilter),
    [employees, statusFilter]
  );

  const detailEmployeeLive = useMemo(() => {
    if (!detailEmployee) return null;
    return employees.find((e) => e.id === detailEmployee.id) ?? detailEmployee;
  }, [detailEmployee, employees]);

  useEffect(() => {
    setDetailEmployee(null);
  }, [statusFilter]);

  useEffect(() => {
    if (!showAddForm || !businessId) return;
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
  }, [showAddForm, businessId, editingEmployee?.id, editingEmployee?.pin]);

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
    });
    setShowPinInForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(formData.pin)) {
      alert(t('employeeManagement.pinMissingError'));
      return;
    }

    // Unformat phone number before saving
    const submitData: any = {
      ...formData,
      phone: unformatPhoneNumber(formData.phone),
    };
    // Convert date strings to ISO format or null
    if (submitData.hire_date) {
      submitData.hire_date = new Date(submitData.hire_date).toISOString();
    } else {
      submitData.hire_date = null;
    }
    if (submitData.last_date) {
      submitData.last_date = new Date(submitData.last_date).toISOString();
    } else {
      submitData.last_date = null;
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
    if (allDob) {
      const month = parseInt(dm, 10);
      const day = parseInt(dd, 10);
      const year = parseInt(dy, 10);
      if (!isValidEmployeeDob(day, month, year)) {
        alert(t('employeeManagement.dobInvalid'));
        return;
      }
      submitData.birth_month = month;
      submitData.birth_day = day;
      submitData.birth_year = year;
    } else {
      submitData.birth_month = null;
      submitData.birth_day = null;
      submitData.birth_year = null;
    }

    // If PIN is being set/changed by manager, set pin_set_at timestamp
    // This marks the PIN as set (whether by manager or employee)
    if (submitData.pin && submitData.pin.length === EMPLOYEE_PIN_LENGTH) {
      const isNewPin = !editingEmployee || editingEmployee.pin !== submitData.pin;
      if (isNewPin) {
        submitData.pin_set_at = new Date().toISOString();
        submitData.pin_required = false; // PIN is now set, no longer required
      }
    }

    if (editingEmployee) {
      onUpdateEmployee(editingEmployee.id, submitData);
      setEditingEmployee(null);
    } else {
      // For new employees, if PIN is provided, set pin_set_at
      if (submitData.pin && submitData.pin.length === EMPLOYEE_PIN_LENGTH) {
        submitData.pin_set_at = new Date().toISOString();
        submitData.pin_required = false;
      }
      onAddEmployee(submitData);
    }
    resetForm();
    setShowAddForm(false);
  };

  const handleEdit = (employee: Employee) => {
    setDetailEmployee(null);
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: formatPhoneNumber(employee.phone),
      pin: employee.pin,
      hourly_rate: employee.hourly_rate,
      role: employee.role,
      status: employee.status,
      hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : '',
      last_date: employee.last_date ? new Date(employee.last_date).toISOString().split('T')[0] : '',
      birth_month: employee.birth_month != null ? String(employee.birth_month) : '',
      birth_day: employee.birth_day != null ? String(employee.birth_day) : '',
      birth_year: employee.birth_year != null ? String(employee.birth_year) : '',
    });
    setShowPinInForm(false);
    setShowAddForm(true);
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
    setShowAddForm(false);
    setEditingEmployee(null);
    resetForm();
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
    await onUpdateEmployee(employeeToDelete, {
      status: 'inactive',
      last_date: removeLastWorkingDate,
    });
    setEmployeeToDelete(null);
    setRemoveLastWorkingDate('');
    setDeleteDialogOpen(false);
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
            setEditingEmployee(null);
            resetForm();
            setShowAddForm(!showAddForm);
          }}
          className="flex shrink-0 items-center gap-2 shadow-sm"
        >
          {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAddForm ? t('common.cancel') : t('employeeManagement.addEmployee')}
        </Button>
      </div>

      {showAddForm && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    required
                    placeholder="jane@example.com"
                  />
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
                          <EyeOff className="w-3 h-3 mr-1" /> Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 mr-1" /> Show
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
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
                    <Button type="button" variant="outline" className="shrink-0" onClick={() => void handleGenerateFormPin()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t('employeeManagement.generatePin')}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hourly Rate ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.50"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: Number(e.target.value) })}
                    required
                  />
                </div>
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
                    onValueChange={(value: 'active' | 'inactive') => setFormData({ ...formData, status: value })}
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
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="shadow-sm">
                  {editingEmployee ? t('common.edit') + ' ' + t('nav.employees') : t('employeeManagement.addEmployee')}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id}>
              <CardContent className="p-0">
                <button
                  type="button"
                  className="flex w-full flex-col gap-1.5 p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => setDetailEmployee(employee)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{employee.name}</h3>
                    <JobTitleBadge employee={employee} />
                  </div>
                  <p className="break-all text-sm text-muted-foreground">{employee.email}</p>
                  <p className="text-sm text-muted-foreground">{formatPhoneNumber(employee.phone)}</p>
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

      <Dialog open={!!detailEmployeeLive} onOpenChange={(open) => !open && setDetailEmployee(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          {detailEmployeeLive && (
            <>
              <DetailModalActionBar
                editLabel={t('common.edit')}
                deleteLabel={t('employeeManagement.deleteEmployee')}
                onEdit={() => {
                  handleEdit(detailEmployeeLive);
                  setDetailEmployee(null);
                }}
                onDelete={() => {
                  handleDeleteClick(detailEmployeeLive.id);
                  setDetailEmployee(null);
                }}
              />
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                  <span>{detailEmployeeLive.name}</span>
                  <JobTitleBadge employee={detailEmployeeLive} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Email:</span> {detailEmployeeLive.email}
                </p>
                <p>
                  <span className="font-medium text-foreground">Phone:</span>{' '}
                  {formatPhoneNumber(detailEmployeeLive.phone)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Rate:</span> $
                  {detailEmployeeLive.hourly_rate}/hr
                </p>
                {detailEmployeeLive.status === 'active' ? (
                  <>
                    {detailEmployeeLive.hire_date ? (
                      <>
                        <p>
                          {t('employeeManagement.hiredOn', {
                            date: formatEmployeeLocaleDate(detailEmployeeLive.hire_date, lang),
                          })}
                        </p>
                        <p>
                          {t('employeeManagement.tenureToDate', {
                            tenure: (() => {
                              const { y, m, d } = calendarDiffYMD(
                                atLocalDay(detailEmployeeLive.hire_date!),
                                todayLocal
                              );
                              return formatTenureYMD(y, m, d, lang);
                            })(),
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="italic">{t('employeeManagement.hireDateMissing')}</p>
                    )}
                  </>
                ) : (
                  <>
                    {detailEmployeeLive.last_date ? (
                      <p>
                        {t('employeeManagement.lastWorkingDay', {
                          date: formatEmployeeLocaleDate(detailEmployeeLive.last_date, lang),
                        })}
                      </p>
                    ) : (
                      <p className="italic">{t('employeeManagement.lastDateMissing')}</p>
                    )}
                    {detailEmployeeLive.hire_date && detailEmployeeLive.last_date ? (
                      <p>
                        {t('employeeManagement.timeWithCompany', {
                          tenure: (() => {
                            const { y, m, d } = calendarDiffYMD(
                              atLocalDay(detailEmployeeLive.hire_date!),
                              atLocalDay(detailEmployeeLive.last_date!)
                            );
                            return formatTenureYMD(y, m, d, lang);
                          })(),
                        })}
                      </p>
                    ) : null}
                  </>
                )}
                {detailEmployeeLive.birth_month != null &&
                  detailEmployeeLive.birth_day != null &&
                  detailEmployeeLive.birth_year != null && (
                    <p>
                      <span className="font-medium text-foreground">
                        {t('employeeManagement.dateOfBirthLabel')}:
                      </span>{' '}
                      {new Date(
                        detailEmployeeLive.birth_year,
                        detailEmployeeLive.birth_month - 1,
                        detailEmployeeLive.birth_day
                      ).toLocaleDateString(lang === 'es' ? 'es' : 'en', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                {detailEmployeeLive.birth_month != null &&
                  detailEmployeeLive.birth_day != null &&
                  detailEmployeeLive.birth_year == null && (
                    <p>
                      <span className="font-medium text-foreground">
                        {t('employeeManagement.dateOfBirthLabel')}:
                      </span>{' '}
                      {detailEmployeeLive.birth_month}/{detailEmployeeLive.birth_day}
                    </p>
                  )}
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">
                      PIN:{' '}
                      {showPin[detailEmployeeLive.id]
                        ? detailEmployeeLive.pin
                        : '•'.repeat(EMPLOYEE_PIN_LENGTH)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      type="button"
                      onClick={() => togglePinVisibility(detailEmployeeLive.id)}
                    >
                      {showPin[detailEmployeeLive.id] ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  {(detailEmployeeLive as any).pin_set_at ? (
                    <Badge variant="outline" className="text-xs">
                      PIN set{' '}
                      {new Date((detailEmployeeLive as any).pin_set_at).toLocaleDateString()}
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="text-xs"
                      onClick={() => handlePinSetup(detailEmployeeLive)}
                    >
                      <Lock className="mr-1 h-3 w-3" />
                      Set PIN
                    </Button>
                  )}
                  {(detailEmployeeLive as any).pin_set_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="text-xs text-muted-foreground"
                      onClick={() => handlePinReset(detailEmployeeLive.id)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Reset PIN
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="mt-1 flex w-full items-center gap-2"
                  onClick={() => handleViewTimesheet(detailEmployeeLive.id)}
                >
                  <Clock className="h-4 w-4" />
                  {t('timesheet.title')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
