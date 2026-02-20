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
const MAX_WIDTH = '28rem';

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
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Contact Email Box – centered */}
      <Card className="mx-auto shadow-md" style={{ maxWidth: MAX_WIDTH }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('help.contactEmail') ?? 'Contact email'}
          </CardTitle>
          <CardDescription>{t('help.contactSupportDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-primary font-medium hover:underline break-all"
          >
            {SUPPORT_EMAIL}
          </a>
          <Button variant="outline" size="sm" onClick={copyEmail} className="shrink-0 gap-1">
            <Copy className="h-4 w-4" />
            {t('help.copy') ?? 'Copy'}
          </Button>
        </CardContent>
      </Card>

      {/* Message Form Box – centered */}
      <Card className="mx-auto shadow-md" style={{ maxWidth: MAX_WIDTH }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t('help.sendMessage') ?? 'Send a message'}
          </CardTitle>
          <CardDescription>{t('help.formDescription') ?? 'Submit your question or feedback and we’ll get back to you.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="help-name">{t('help.yourName')} <span className="text-destructive">*</span></Label>
              <Input
                id="help-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="help-email">{t('help.yourEmail')} <span className="text-destructive">*</span></Label>
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
              <Label htmlFor="help-message">{t('help.message')} <span className="text-destructive">*</span></Label>
              <Textarea
                id="help-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full gap-2">
              {submitting ? t('common.saving') : t('help.submit')}
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
