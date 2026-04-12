import termsMarkdownEn from '@/content/legal/grumi_terms_of_service.en.md?raw';
import termsMarkdown from '@/content/legal/grumi_terms_of_service.md?raw';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { LegalDocumentPage } from '@/pages/legal/LegalDocumentPage';

const ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/terms')!;

export function TermsOfService() {
  return (
    <LegalDocumentPage route={ROUTE} markdown={termsMarkdown} markdownEn={termsMarkdownEn} />
  );
}
