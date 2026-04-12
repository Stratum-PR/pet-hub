import { useState, isValidElement, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DiscoverableRoute } from '@/config/discoverable-routes';
import { getPublicBaseUrl } from '@/config/discoverable-routes';
import { PageMeta } from '@/components/PageMeta';
import { Footer } from '@/components/Footer';
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader';
import { useLanguage } from '@/contexts/LanguageContext';

const GRUMI_PET = /^https?:\/\/(www\.)?grumi\.pet(?=\/|$)/i;

function rewriteGrumiPath(pathname: string): string {
  if (pathname === '/precios') return '/pricing';
  return pathname;
}

function markdownPlainText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(markdownPlainText).join('');
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return markdownPlainText(props.children);
  }
  return '';
}

function LegalMarkdownLink({
  href,
  children,
  className,
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href == null || href === '') {
    return <span className={className}>{children}</span>;
  }
  if (href.startsWith('/')) {
    try {
      const u = new URL(href, 'https://placeholder.local');
      const path = rewriteGrumiPath(u.pathname);
      const to = `${path}${u.search}${u.hash}`;
      return (
        <Link to={to} className={className}>
          {children}
        </Link>
      );
    } catch {
      return (
        <a href={href} className={className} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
  }
  if (GRUMI_PET.test(href)) {
    try {
      const u = new URL(href);
      const path = rewriteGrumiPath(u.pathname || '/');
      const to = `${path}${u.search}${u.hash}`;
      return (
        <Link to={to} className={className}>
          {children}
        </Link>
      );
    } catch {
      /* fall through */
    }
  }
  try {
    const base = getPublicBaseUrl();
    const resolved = new URL(href, base);
    const baseUrl = new URL(base);
    if (resolved.origin === baseUrl.origin) {
      const path = rewriteGrumiPath(resolved.pathname || '/');
      const to = `${path}${resolved.search}${resolved.hash}`;
      return (
        <Link to={to || '/'} className={className}>
          {children}
        </Link>
      );
    }
  } catch {
    /* fall through */
  }
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

type Props = {
  route: DiscoverableRoute;
  markdown: string;
  /** When set, English UI shows this Markdown instead of `markdown`. */
  markdownEn?: string;
};

export function LegalDocumentPage({ route, markdown, markdownEn }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language } = useLanguage();
  const bodyMarkdown = language === 'en' && markdownEn ? markdownEn : markdown;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageMeta route={route} />
      <MarketingSiteHeader
        mode="standard"
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
      />
      <main className="flex-1 pt-28 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card text-card-foreground shadow-sm p-6 md:p-10">
            <article className="prose prose-neutral prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:scroll-mt-28">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children, className }) => (
                    <LegalMarkdownLink href={href} className={className}>
                      {children}
                    </LegalMarkdownLink>
                  ),
                  h2: ({ children, className, ...rest }) => {
                    const flat = markdownPlainText(children).toLowerCase();
                    const id = flat.includes('cookie') ? 'cookie-notice' : undefined;
                    return (
                      <h2 id={id} className={className} {...rest}>
                        {children}
                      </h2>
                    );
                  },
                }}
              >
                {bodyMarkdown}
              </ReactMarkdown>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
