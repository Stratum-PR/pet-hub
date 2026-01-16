import { useState } from 'react';
import { Palette, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Employee, TimeEntry } from '@/types';
import { Settings } from '@/hooks/useSupabaseData';
import { format, differenceInHours, startOfWeek } from 'date-fns';
import { toast } from 'sonner';

interface AdminProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
  settings: Settings;
  onSaveSettings: (settings: Settings) => Promise<boolean>;
}

export function Admin({ 
  employees, 
  timeEntries, 
  settings,
  onSaveSettings 
}: AdminProps) {
  const [settingsFormData, setSettingsFormData] = useState({
    business_name: settings.business_name,
    business_hours: settings.business_hours,
    color_scheme: settings.color_scheme,
  });

  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const success = await onSaveSettings(settingsFormData);
    setSavingSettings(false);
    
    if (success) {
      toast.success('Settings saved successfully!');
    } else {
      toast.error('Failed to save settings. Please try again.');
    }
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage payroll and personalization
        </p>
      </div>

      <Tabs defaultValue="payroll" className="space-y-6">
        <TabsList>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="personalization" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Personalization
          </TabsTrigger>
        </TabsList>

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

        {/* Personalization Tab */}
        <TabsContent value="personalization" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Business Personalization</CardTitle>
              <CardDescription>Configure your business preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input 
                    value={settingsFormData.business_name}
                    onChange={(e) => setSettingsFormData({ ...settingsFormData, business_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Hours</Label>
                  <Input 
                    value={settingsFormData.business_hours}
                    onChange={(e) => setSettingsFormData({ ...settingsFormData, business_hours: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color Scheme</Label>
                  <Select 
                    value={settingsFormData.color_scheme}
                    onValueChange={(value) => setSettingsFormData({ ...settingsFormData, color_scheme: value })}
                  >
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
                <Button type="submit" className="mt-4 shadow-sm" disabled={savingSettings}>
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
