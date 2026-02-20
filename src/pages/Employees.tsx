import { useState } from 'react';
import { Clock, CheckCircle, LogIn, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Employee, TimeEntry } from '@/types';
import { format } from 'date-fns';
import { t } from '@/lib/translations';

interface EmployeesProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
  onClockIn: (employeeId: string) => void;
  onClockOut: (entryId: string) => void;
  getActiveEntry: (employeeId: string) => TimeEntry | undefined;
}

export function Employees({ employees, timeEntries, onClockIn, onClockOut, getActiveEntry }: EmployeesProps) {
  const [pin, setPin] = useState('');
  const [verifiedEmployee, setVerifiedEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeEmployees = employees.filter(e => e.status === 'active');

  const handleVerifyPin = () => {
    setError('');
    setSuccess('');
    const employee = activeEmployees.find(e => e.pin === pin);
    if (employee) {
      setVerifiedEmployee(employee);
      setPin('');
    } else {
      setError('Invalid PIN. Please try again.');
    }
  };

  const handleClockAction = () => {
    if (!verifiedEmployee) return;
    
    const activeEntry = getActiveEntry(verifiedEmployee.id);
    if (activeEntry) {
      onClockOut(activeEntry.id);
      setSuccess(t('timeTracking.clockedOut', { name: verifiedEmployee.name }));
    } else {
      onClockIn(verifiedEmployee.id);
      setSuccess(t('timeTracking.clockedIn', { name: verifiedEmployee.name }));
    }
    
    setTimeout(() => {
      setVerifiedEmployee(null);
      setSuccess('');
    }, 3000);
  };

  const handleLogout = () => {
    setVerifiedEmployee(null);
    setError('');
    setSuccess('');
  };

  // Get today's entries
  const todayEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.clock_in).toDateString();
    const today = new Date().toDateString();
    return entryDate === today;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clock In/Out Section */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {verifiedEmployee ? t('timeTracking.welcome', { name: verifiedEmployee.name }) : t('timeTracking.employeeVerification')}
            </CardTitle>
            <CardDescription>
              {verifiedEmployee ? t('timeTracking.readyToClock') : t('timeTracking.enterPin')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!verifiedEmployee ? (
              <div className="space-y-4">
                <Input
                  type="password"
                  maxLength={4}
                  placeholder={t('timeTracking.enterPinPlaceholder')}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyPin()}
                />
                {error && (
                  <p className="text-destructive text-sm text-center">{error}</p>
                )}
                <Button onClick={handleVerifyPin} className="w-full" disabled={pin.length < 4}>
                  {t('timeTracking.verify')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {success && (
                  <div className="p-4 bg-success/10 rounded-lg flex items-center gap-2 text-success">
                    <CheckCircle className="w-5 h-5" />
                    <span>{success}</span>
                  </div>
                )}
                
                {!success && (
                  <>
                    {getActiveEntry(verifiedEmployee.id) ? (
                      <div className="text-center space-y-4">
                        <div className="p-4 bg-primary/10 rounded-lg">
                          <p className="text-sm text-muted-foreground">Currently clocked in since</p>
                          <p className="text-lg font-semibold">
                            {format(new Date(getActiveEntry(verifiedEmployee.id)!.clock_in), 'h:mm a')}
                          </p>
                        </div>
                        <Button 
                          onClick={handleClockAction} 
                          className="w-full bg-destructive hover:bg-destructive/90"
                          size="lg"
                        >
                          <LogOut className="w-5 h-5 mr-2" />
                          {t('timeTracking.clockOut')}
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={handleClockAction} 
                        className="w-full"
                        size="lg"
                      >
                        <LogIn className="w-5 h-5 mr-2" />
                        {t('timeTracking.clockIn')}
                      </Button>
                    )}
                  </>
                )}
                
                <Button variant="outline" onClick={handleLogout} className="w-full">
                  {t('timeTracking.switchUser')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Activity */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {t('timeTracking.todaysActivity')}
            </CardTitle>
            <CardDescription>
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todayEntries.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No activity today</p>
            ) : (
              <div className="space-y-3">
                {todayEntries.map((entry) => {
                  const employee = employees.find(e => e.id === entry.employee_id);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{employee?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          In: {format(new Date(entry.clock_in), 'h:mm a')}
                          {entry.clock_out && ` • Out: ${format(new Date(entry.clock_out), 'h:mm a')}`}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        entry.clock_out 
                          ? 'bg-muted text-muted-foreground' 
                          : 'bg-success/10 text-success'
                      }`}>
                        {entry.clock_out ? 'Completed' : 'Active'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}