import cookieNoticeMarkdownEn from '@/content/legal/grumi_cookie_notice.en.md?raw';
import cookieNoticeMarkdown from '@/content/legal/grumi_cookie_notice.md?raw';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { LegalDocumentPage } from '@/pages/legal/LegalDocumentPage';

const ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/cookie-notice')!;

export function CookieNotice() {
  return (
    <LegalDocumentPage route={ROUTE} markdown={cookieNoticeMarkdown} markdownEn={cookieNoticeMarkdownEn} />
  );
}
