import privacyMarkdown from '@/content/legal/grumi_privacy_policy.md?raw';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { LegalDocumentPage } from '@/pages/legal/LegalDocumentPage';

const ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/privacy')!;

export function PrivacyPolicy() {
  return <LegalDocumentPage route={ROUTE} markdown={privacyMarkdown} />;
}
