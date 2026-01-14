import { useState } from 'react';
import { Settings, Users, DollarSign, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Employee, TimeEntry } from '@/types';
import { format, differenceInHours, startOfWeek } from 'date-fns';

interface AdminProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
  onAddEmployee: (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateEmployee: (id: string, employee: Partial<Employee>) => void;
  onDeleteEmployee: (id: string) => void;
}

export function Admin({ employees, timeEntries, onAddEmployee, onUpdateEmployee, onDeleteEmployee }: AdminProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showPin, setShowPin] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    pin: '',
    hourly_rate: 15,
    role: 'groomer',
    status: 'active' as 'active' | 'inactive',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      pin: '',
      hourly_rate: 15,
      role: 'groomer',
      status: 'active',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      onUpdateEmployee(editingEmployee.id, formData);
      setEditingEmployee(null);
    } else {
      onAddEmployee(formData);
    }
    resetForm();
    setShowAddForm(false);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      pin: employee.pin,
      hourly_rate: employee.hourly_rate,
      role: employee.role,
      status: employee.status,
    });
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingEmployee(null);
    resetForm();
  };

  // Calculate payroll data
  const weekStart = startOfWeek(new Date());
  const payrollData = employees.map(emp => {
    const empEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.clock_in);
      return entry.employee_id === emp.id && entryDate >= weekStart && entry.clock_out;
    });
    
    const totalHours = empEntries.reduce((sum, entry) => {
      if (!entry.clock_out) return sum;
      return sum + differenceInHours(new Date(entry.clock_out), new Date(entry.clock_in));
    }, 0);
    
    return {
      ...emp,
      hoursWorked: totalHours,
      grossPay: totalHours * emp.hourly_rate,
    };
  });

  const togglePinVisibility = (id: string) => {
    setShowPin(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground mt-1">
          Manage employees, payroll, and settings
        </p>
      </div>

      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList>
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Employee Management</h2>
            <Button 
              onClick={() => {
                setEditingEmployee(null);
                resetForm();
                setShowAddForm(!showAddForm);
              }}
              className="shadow-sm"
            >
              {showAddForm ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> Add Employee</>}
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
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>4-Digit PIN</Label>
                      <Input
                        type="password"
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
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="shadow-sm">
                      {editingEmployee ? 'Update Employee' : 'Add Employee'}
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
                        onClick={() => onDeleteEmployee(employee.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>{employee.email}</p>
                    <p>{employee.phone}</p>
                    <p className="capitalize">Role: {employee.role}</p>
                    <p>Rate: ${employee.hourly_rate}/hr</p>
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {employees.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No employees yet. Add your first employee above!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Weekly Payroll Summary</CardTitle>
              <CardDescription>
                Week of {format(weekStart, 'MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium">Employee</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      <th className="text-right py-3 px-4 font-medium">Hours</th>
                      <th className="text-right py-3 px-4 font-medium">Rate</th>
                      <th className="text-right py-3 px-4 font-medium">Gross Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollData.map(emp => (
                      <tr key={emp.id} className="border-b border-border">
                        <td className="py-3 px-4">{emp.name}</td>
                        <td className="py-3 px-4 capitalize">{emp.role}</td>
                        <td className="py-3 px-4 text-right">{emp.hoursWorked}h</td>
                        <td className="py-3 px-4 text-right">${emp.hourly_rate}/hr</td>
                        <td className="py-3 px-4 text-right font-semibold">${emp.grossPay.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/50">
                      <td colSpan={2} className="py-3 px-4 font-semibold">Total</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {payrollData.reduce((sum, e) => sum + e.hoursWorked, 0)}h
                      </td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right font-bold">
                        ${payrollData.reduce((sum, e) => sum + e.grossPay, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Business Settings</CardTitle>
              <CardDescription>Configure your business preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input defaultValue="Stratum Hub" />
              </div>
              <div className="space-y-2">
                <Label>Business Hours</Label>
                <Input defaultValue="9:00 AM - 6:00 PM" />
              </div>
              <div className="space-y-2">
                <Label>Color Scheme</Label>
                <Select defaultValue="soft-green-blue">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft-green-blue">Soft Green & Blue</SelectItem>
                    <SelectItem value="purple-turquoise">Purple to Turquoise</SelectItem>
                    <SelectItem value="yellow-orange">Yellow & Orange</SelectItem>
                    <SelectItem value="pink-orange">Pink & Orange</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="mt-4 shadow-sm">Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}