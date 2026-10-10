import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
    );
  });

  it('escapes & first, so existing entities are not double-decoded', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });

  it('leaves ordinary text (accents, ñ, slashes, URLs) unchanged', () => {
    expect(escapeHtml('Peluquería Ñandú / https://grumi.pet/mi-negocio/portal')).toBe(
      'Peluquería Ñandú / https://grumi.pet/mi-negocio/portal'
    );
  });

  it('turns null and undefined into an empty string and stringifies other values', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });

  it('neutralises a script-injection payload', () => {
    const out = escapeHtml('</h2><script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });
});
