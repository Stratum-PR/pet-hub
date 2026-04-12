import websiteTermsMarkdownEn from '@/content/legal/grumi_website_terms.en.md?raw';
import websiteTermsMarkdown from '@/content/legal/grumi_website_terms.md?raw';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { LegalDocumentPage } from '@/pages/legal/LegalDocumentPage';

const ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/website-terms')!;

export function WebsiteTerms() {
  return (
    <LegalDocumentPage
      route={ROUTE}
      markdown={websiteTermsMarkdown}
      markdownEn={websiteTermsMarkdownEn}
    />
  );
}
