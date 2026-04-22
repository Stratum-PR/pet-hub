import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { Copy, Mail } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const SUPPORT_EMAIL = 'support@stratumpr.com';

export function Help() {
  useLanguage(); // Ensure instant re-render on language toggle
  const copyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL).then(
      () => toast.success(t('help.emailCopied') ?? 'Email copied to clipboard'),
      () => toast.error(t('common.genericError'))
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <Card className="flex min-h-0 flex-col overflow-hidden shadow-none hover:shadow-md md:max-h-full">
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
    </div>
  );
}
