import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, EyeOff, Users, Clock, Link2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee } from '@/types';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phoneFormat';
import { t } from '@/lib/translations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmployeeManagementProps {
  employees: Employee[];
  onAddEmployee: (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateEmployee: (id: string, employee: Partial<Employee>) => void;
  onDeleteEmployee: (id: string) => void;
}

export function EmployeeManagement({ 
  employees, 
  onAddEmployee, 
  onUpdateEmployee, 
  onDeleteEmployee 
}: EmployeeManagementProps) {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPin, setShowPin] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
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
  });
  const [showPinInForm, setShowPinInForm] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

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
    });
    setShowPinInForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    if (editingEmployee) {
      onUpdateEmployee(editingEmployee.id, submitData);
      setEditingEmployee(null);
    } else {
      onAddEmployee(submitData);
    }
    resetForm();
    setShowAddForm(false);
  };

  const handleEdit = (employee: Employee) => {
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
    });
    setShowPinInForm(false);
    setShowAddForm(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const handleViewTimesheet = (employeeId: string) => {
    if (businessSlug) {
      navigate(`/${businessSlug}/reports/payroll/employee/${employeeId}/timesheet`);
    } else {
      navigate(`/reports/payroll/employee/${employeeId}/timesheet`);
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
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (employeeToDelete) {
      onDeleteEmployee(employeeToDelete);
      setEmployeeToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const handleCreateInvite = async () => {
    setInviteLoading(true);
    setInviteLink(null);
    try {
      const { data, error } = await supabase.rpc('create_employee_invite', {
        p_email: null,
        p_expires_days: 7,
      });
      if (error) {
        toast.error(error.message || 'Could not create invite');
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      const token = row?.invite_token;
      if (token) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const url = `${origin}/signup?invite=${token}`;
        setInviteLink(url);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create invite');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied to clipboard');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            {t('employeeManagement.inviteEmployee')}
          </CardTitle>
          <CardDescription>
            {t('employeeManagement.inviteEmployeeDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!inviteLink ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleCreateInvite}
              disabled={inviteLoading}
            >
              {inviteLoading ? t('signup.creating') : t('employeeManagement.createInviteLink')}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground break-all">{inviteLink}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleCopyInviteLink}>
                  <Copy className="w-4 h-4 mr-2" />
                  {t('employeeManagement.copyInviteLink')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInviteLink(null);
                  }}
                >
                  {t('employeeManagement.createNewInvite')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('employeeManagement.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('employeeManagement.description')}
          </p>
        </div>
        <Button 
          onClick={() => {
            setEditingEmployee(null);
            resetForm();
            setShowAddForm(!showAddForm);
          }}
          className="shadow-sm"
        >
          {showAddForm ? t('common.cancel') : <><Plus className="w-4 h-4 mr-2" /> {t('employeeManagement.addEmployee')}</>}
        </Button>
      </div>

      {showAddForm && (
        <Card className="shadow-sm animate-fade-in">
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
                    <Label>4-Digit PIN</Label>
                    {editingEmployee && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPinInForm(!showPinInForm)}
                        className="h-6 text-xs"
                      >
                        {showPinInForm ? <><EyeOff className="w-3 h-3 mr-1" /> Hide</> : <><Eye className="w-3 h-3 mr-1" /> Show</>}
                      </Button>
                    )}
                  </div>
                  <Input
                    type={showPinInForm || !editingEmployee ? "text" : "password"}
                    maxLength={4}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                    required
                    placeholder="1234"
                  />
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
                  <Label>Role</Label>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map(employee => (
          <Card key={employee.id} className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{employee.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    employee.status === 'active' 
                      ? 'bg-success/10 text-success' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {employee.status}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(employee)}
                    className="h-8 w-8"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(employee.id)}
                    className="h-8 w-8 text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{employee.email}</p>
                <p>{formatPhoneNumber(employee.phone)}</p>
                <p className="capitalize">Role: {employee.role}</p>
                <p>Rate: ${employee.hourly_rate}/hr</p>
                {employee.hire_date && (
                  <p>Hired: {new Date(employee.hire_date).toLocaleDateString()}</p>
                )}
                {employee.last_date && (
                  <p>Last Date: {new Date(employee.last_date).toLocaleDateString()}</p>
                )}
                <div className="flex items-center gap-2">
                  <span>PIN: {showPin[employee.id] ? employee.pin : '••••'}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => togglePinVisibility(employee.id)}
                  >
                    {showPin[employee.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                </div>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewTimesheet(employee.id)}
                    className="w-full flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    {t('timesheet.title')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {employees.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('employeeManagement.noEmployeesYet')}</p>
          </CardContent>
        </Card>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={t('employeeManagement.deleteEmployee')}
        description={t('employeeManagement.deleteConfirm')}
      />
    </div>
  );
}
