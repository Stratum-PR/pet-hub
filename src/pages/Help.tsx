import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { Copy, Mail, Send } from 'lucide-react';

const FORMSPREE_FORM_ID = import.meta.env.VITE_FORMSPREE_HELP_FORM_ID || 'xyzjgyzq';
const FORMSPREE_ENDPOINT = `https://formspree.io/f/${FORMSPREE_FORM_ID}`;

const SUPPORT_EMAIL = 'admin@stratumpr.com';

export function Help() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(
      () => toast.success(t('help.emailCopied') ?? 'Email copied to clipboard'),
      () => toast.error(t('common.genericError'))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
          subject: subject?.trim() || 'Pet Hub – Need Help',
          _replyto: trimmedEmail,
          _subject: subject?.trim() || 'Pet Hub – Need Help',
        }),
      });
      if (res.ok) {
        toast.success(t('help.messageSent'));
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
      } else {
        try {
          const err = await res.json().catch(() => ({}));
          toast.error((err as { error?: string })?.error || t('common.genericError'));
        } catch {
          toast.error(t('common.genericError'));
        }
      }
    } catch {
      toast.error(t('common.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden md:grid md:grid-cols-2 md:grid-rows-1 md:items-stretch md:gap-6">
      <Card className="flex min-h-0 flex-col overflow-hidden shadow-md md:max-h-full">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 shrink-0 opacity-100" />
            {t('help.contactEmail') ?? 'Contact email'}
          </CardTitle>
          <CardDescription className="text-xs">{t('help.contactSupportDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-hidden pt-0">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-primary font-medium hover:underline break-all text-sm"
          >
            {SUPPORT_EMAIL}
          </a>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyEmail}
              className="shrink-0 gap-1 bg-background text-foreground opacity-100 hover:bg-muted hover:opacity-100"
            >
              <Copy className="h-4 w-4 opacity-100" />
              {t('help.copy') ?? 'Copy'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-md md:max-h-full">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-5 w-5 shrink-0 opacity-100" />
            {t('help.sendMessage') ?? 'Send a message'}
          </CardTitle>
          <CardDescription className="text-xs">
            {t('help.formDescription') ?? 'Submit your question or feedback and we’ll get back to you.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="help-name" className="text-xs">
                  {t('help.yourName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="help-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-9 bg-background text-foreground"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="help-email" className="text-xs">
                  {t('help.yourEmail')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="help-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-9 bg-background text-foreground"
                />
              </div>
            </div>
            <div className="shrink-0 space-y-1">
              <Label htmlFor="help-subject" className="text-xs">
                {t('help.subject')}
              </Label>
              <Input
                id="help-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Pet Hub – Need Help"
                className="h-9 bg-background text-foreground"
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col space-y-1">
              <Label htmlFor="help-message" className="shrink-0 text-xs">
                {t('help.message')} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="help-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                required
                className="min-h-0 flex-1 resize-none bg-background text-foreground"
              />
            </div>
            <Button type="submit" disabled={submitting} className="mt-auto w-full shrink-0 gap-2">
              {submitting ? t('common.saving') : t('help.submit')}
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
