import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSupabaseData';

const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_HELP_FORM_ID
  ? `https://formspree.io/f/${import.meta.env.VITE_FORMSPREE_HELP_FORM_ID}`
  : '';

export function Help() {
  const { settings } = useSettings();
  const businessName = settings?.business_name || undefined;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!FORMSPREE_ENDPOINT) {
      toast.error('Contact form is not configured. Set VITE_FORMSPREE_HELP_FORM_ID.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject: subject || 'Pet Hub – Need Help',
          message,
          _replyto: email,
        }),
      });
      if (res.ok) {
        toast.success(t('help.messageSent'));
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
      } else {
        toast.error(t('common.genericError'));
      }
    } catch {
      toast.error(t('common.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const contactEmail = 'admin@stratumpr.com';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('nav.help')}</h1>
        <p className="text-muted-foreground mt-1">{t('help.description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{businessName || 'Pet Hub'}</CardTitle>
          <CardDescription>{t('help.contactSupportDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">{t('help.contactEmail')}</Label>
            <p className="mt-1">
              <a
                href={`mailto:${contactEmail}`}
                className="text-primary font-medium hover:underline"
              >
                {contactEmail}
              </a>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="help-name">{t('help.yourName')}</Label>
              <Input
                id="help-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="help-email">{t('help.yourEmail')}</Label>
              <Input
                id="help-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="help-subject">{t('help.subject')}</Label>
              <Input
                id="help-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Pet Hub – Need Help"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="help-message">{t('help.message')}</Label>
              <Textarea
                id="help-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
              />
            </div>
            <Button type="submit" disabled={submitting || !FORMSPREE_ENDPOINT}>
              {submitting ? t('common.saving') : t('help.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
