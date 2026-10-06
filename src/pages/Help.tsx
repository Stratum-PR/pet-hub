import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { CheckCircle2, Copy, Mail, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';

const SUPPORT_EMAIL = 'support@stratumpr.com';
const TOPICS = ['question', 'problem', 'billing', 'suggestion'] as const;
type Topic = (typeof TOPICS)[number];

export function Help() {
  useLanguage(); // Ensure instant re-render on language toggle
  const { user } = useAuth();
  const demoBrowseOnly = useDemoBrowseOnly();
  const [topic, setTopic] = useState<Topic>('question');
  const [replyTo, setReplyTo] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user?.email && !replyTo) setReplyTo(user.email);
  }, [user?.email, replyTo]);

  const copyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(
      () => toast.success(t('help.emailCopied') ?? 'Email copied to clipboard'),
      () => toast.error(t('common.genericError'))
    );
  };

  const canSend = !!user && !demoBrowseOnly;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    if (message.trim().length < 5) {
      toast.error(t('help.messageTooShort'));
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('support-contact', {
        body: { topic, message: message.trim(), reply_to: replyTo.trim(), page: window.location.pathname },
      });
      if (error || !(data as { sent?: boolean } | null)?.sent) {
        const status = (error as { context?: { status?: number } } | null)?.context?.status;
        devConsole.error('[Help] support-contact failed', error ?? data);
        toast.error(status === 429 ? t('help.tooMany') : t('help.sendFailed'));
        return;
      }
      setSent(true);
      setMessage('');
      toast.success(t('help.messageSent'));
    } catch (err) {
      devConsole.error('[Help] support-contact threw', err);
      toast.error(t('help.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5 shrink-0" />
            {t('help.sendMessage')}
          </CardTitle>
          <CardDescription className="text-xs">{t('help.formDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {sent ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                {t('help.messageSent')}
              </p>
              <p className="text-xs text-muted-foreground">{t('help.replyNote', { email: replyTo })}</p>
              <Button variant="outline" size="sm" onClick={() => setSent(false)}>
                {t('help.sendAnother')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="help-topic">{t('help.subject')}</Label>
                  <Select value={topic} onValueChange={(v) => setTopic(v as Topic)} disabled={!canSend}>
                    <SelectTrigger id="help-topic">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOPICS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {t(`help.topic.${key}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="help-reply">{t('help.replyTo')}</Label>
                  <Input
                    id="help-reply"
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    required
                    disabled={!canSend}
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="help-message">{t('help.message')}</Label>
                <Textarea
                  id="help-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('help.messagePlaceholder')}
                  rows={6}
                  maxLength={4000}
                  required
                  disabled={!canSend}
                />
              </div>
              {!canSend ? (
                <p className="text-xs text-muted-foreground">{t('help.formUnavailable')}</p>
              ) : null}
              <Button type="submit" disabled={!canSend || sending} className="w-full sm:w-auto">
                {sending ? t('help.sending') : t('help.submit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 shrink-0" />
            {t('help.contactEmail')}
          </CardTitle>
          <CardDescription className="text-xs">{t('help.emailDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="break-all text-sm font-medium text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          <div>
            <Button variant="outline" size="sm" onClick={copyEmail} className="gap-1">
              <Copy className="h-4 w-4" />
              {t('help.copy')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
