import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Business } from '@/lib/auth';
import { format } from 'date-fns';
import { ArrowLeft, Lock, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { t } from '@/lib/translations';

export function AdminBusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonationUrl, setImpersonationUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBusiness();
    }
  }, [id]);

  const fetchBusiness = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setBusiness(data);
    } catch (error) {
      console.error('Error fetching business:', error);
      toast.error('Failed to load business details');
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async () => {
    if (!id) return;

    try {
      // Call Supabase RPC function to generate impersonation token
      const { data: tokenData, error: tokenError } = await supabase.rpc('generate_impersonation_token', {
        target_business_id: id,
      });

      if (tokenError) {
        throw new Error(tokenError.message);
      }

      // The function returns an array with {token, expires_at}
      const tokenResult = Array.isArray(tokenData) ? tokenData[0] : tokenData;
      
      if (!tokenResult || !tokenResult.token) {
        throw new Error('Failed to generate token');
      }

      // Get business name for the URL
      const businessName = business?.name || 'Business';
      const baseUrl = window.location.origin;
      const impersonateUrl = `${baseUrl}/admin/impersonate/${tokenResult.token}`;
      
      setImpersonationUrl(impersonateUrl);

      // Open in new tab
      window.open(impersonateUrl, '_blank');
      toast.success(`Opening ${businessName} dashboard in new tab...`);
    } catch (error: any) {
      console.error('Error generating impersonation token:', error);
      toast.error(t('common.genericError') || 'Failed to generate impersonation link');
    }
  };

  const handleCopyUrl = () => {
    if (impersonationUrl) {
      navigator.clipboard.writeText(impersonationUrl);
      setCopied(true);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Business not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{business.name}</h1>
              <p className="text-sm text-muted-foreground">{business.email}</p>
            </div>
            <Button onClick={handleImpersonate} className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Login as Business
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-base">{business.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-base">{business.email}</p>
              </div>
              {business.phone && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-base">{business.phone}</p>
                </div>
              )}
              {(business.address || business.city || business.state) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-base">
                    {[business.address, business.city, business.state, business.zip_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              )}
              {business.website && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Website</label>
                  <p className="text-base">
                    <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {business.website}
                    </a>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Details */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tier</label>
                <div className="mt-1">
                  <Badge variant={business.subscription_tier === 'enterprise' ? 'default' : 'secondary'}>
                    {business.subscription_tier}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge
                    variant={
                      business.subscription_status === 'active'
                        ? 'default'
                        : business.subscription_status === 'canceled'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {business.subscription_status}
                  </Badge>
                </div>
              </div>
              {business.stripe_customer_id && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stripe Customer ID</label>
                  <p className="text-base font-mono text-sm">{business.stripe_customer_id}</p>
                </div>
              )}
              {business.stripe_subscription_id && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stripe Subscription ID</label>
                  <p className="text-base font-mono text-sm">{business.stripe_subscription_id}</p>
                </div>
              )}
              {business.trial_ends_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Trial Ends</label>
                  <p className="text-base">{format(new Date(business.trial_ends_at), 'MMM d, yyyy')}</p>
                </div>
              )}
              {business.subscription_ends_at && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subscription Ends</label>
                  <p className="text-base">{format(new Date(business.subscription_ends_at), 'MMM d, yyyy')}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Onboarding</label>
                <p className="text-base">
                  {business.onboarding_completed ? (
                    <Badge variant="default">Completed</Badge>
                  ) : (
                    <Badge variant="outline">Incomplete</Badge>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p className="text-base">{format(new Date(business.created_at), 'MMM d, yyyy')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Impersonation URL */}
        {impersonationUrl && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Impersonation Link</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={impersonationUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md font-mono text-sm"
                />
                <Button variant="outline" onClick={handleCopyUrl}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This link expires in 1 hour and can only be used once.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
