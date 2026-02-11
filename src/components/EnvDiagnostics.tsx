/**
 * Environment Variables Diagnostic Component
 * 
 * This component helps diagnose missing environment variables in production.
 * Add this to your dashboard or a debug page to verify Vercel configuration.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export function EnvDiagnostics() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const appUrl = import.meta.env.VITE_APP_URL;
  
  const envVars = {
    'VITE_SUPABASE_URL': supabaseUrl,
    'VITE_SUPABASE_PUBLISHABLE_KEY': supabaseKey,
    'VITE_APP_URL': appUrl,
  };

  const checkStatus = (value: string | undefined) => {
    if (!value) return { status: 'missing', icon: XCircle, color: 'destructive' };
    if (value.includes('localhost') || value.includes('127.0.0.1')) {
      return { status: 'local', icon: AlertCircle, color: 'warning' };
    }
    return { status: 'ok', icon: CheckCircle2, color: 'default' };
  };

  return (
    <Card className="m-4 border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Environment Variables Diagnostic
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          This diagnostic shows the status of your environment variables.
          If any are missing or pointing to localhost, your app won't work in production.
        </div>

        {Object.entries(envVars).map(([key, value]) => {
          const check = checkStatus(value);
          const Icon = check.icon;
          
          return (
            <div key={key} className="flex items-start gap-3 p-3 border rounded-lg">
              <Icon className={`w-5 h-5 mt-0.5 ${
                check.status === 'ok' ? 'text-green-600' : 
                check.status === 'local' ? 'text-yellow-600' : 
                'text-red-600'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-sm font-mono font-semibold">{key}</code>
                  <Badge variant={check.status === 'ok' ? 'default' : check.status === 'local' ? 'secondary' : 'destructive'}>
                    {check.status === 'ok' ? 'OK' : check.status === 'local' ? 'LOCAL' : 'MISSING'}
                  </Badge>
                </div>
                {value ? (
                  <div className="text-xs text-muted-foreground font-mono break-all">
                    {key === 'VITE_SUPABASE_PUBLISHABLE_KEY' 
                      ? `${value.substring(0, 20)}...` 
                      : value}
                  </div>
                ) : (
                  <div className="text-xs text-red-600">
                    ⚠️ This variable is not set. Add it to Vercel Environment Variables.
                  </div>
                )}
                {value && value.includes('localhost') && (
                  <div className="text-xs text-yellow-600 mt-1">
                    ⚠️ This value points to localhost. Update it for production.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">How to Fix:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Go to Vercel Dashboard → Your Project → Settings → Environment Variables</li>
            <li>Add each variable listed above with the correct production values</li>
            <li>Set them for Production, Preview, AND Development environments</li>
            <li>Redeploy your application</li>
          </ol>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Current Environment:</h4>
          <div className="text-sm font-mono text-blue-800 dark:text-blue-200">
            {import.meta.env.MODE} ({import.meta.env.PROD ? 'Production' : 'Development'})
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
