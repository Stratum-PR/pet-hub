// @vitest-environment jsdom
// U25: the QR SVG shown in Business Settings (and in its print window) is read back from `businesses.qr_code`,
// a text column any member of the business can write directly through the API. It must be sanitised before it
// reaches dangerouslySetInnerHTML / document.write, and the print window's other values must be escaped.
import { describe, expect, it } from 'vitest';
import { buildQrPrintHtml, generateBusinessPortalQrSvg, sanitizeQrSvg } from './qrCode';

function serializeAsParsed(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return new XMLSerializer().serializeToString(doc.documentElement);
}

const BRANDING_INITIALS = { businessName: 'Mi Negocio', logoUrl: null };
const BRANDING_LOGO = {
  businessName: 'Mi Negocio',
  logoUrl: 'https://abc.supabase.co/storage/v1/object/public/logos/a.png?x=1&y=2',
};

describe('sanitizeQrSvg', () => {
  it('keeps the trusted generator output unchanged (initials variant)', async () => {
    const svg = await generateBusinessPortalQrSvg('mi-negocio', '#123456', 'https://grumi.pet', BRANDING_INITIALS);
    expect(sanitizeQrSvg(svg)).toBe(serializeAsParsed(svg));
  });

  it('keeps the trusted generator output unchanged (logo variant)', async () => {
    const svg = await generateBusinessPortalQrSvg('mi-negocio', '127 18% 47%', 'https://grumi.pet', BRANDING_LOGO);
    const out = sanitizeQrSvg(svg);
    expect(out).toBe(serializeAsParsed(svg));
    expect(out).toContain('<image');
    expect(out).toContain('https://abc.supabase.co/storage/v1/object/public/logos/a.png?x=1&amp;y=2');
  });

  it('keeps a data:image logo', async () => {
    const svg = await generateBusinessPortalQrSvg('mi-negocio', null, 'https://grumi.pet', {
      businessName: 'X',
      logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(sanitizeQrSvg(svg)).toContain('href="data:image/png;base64,iVBORw0KGgo="');
  });

  it('removes script, foreignObject, style, animation and unknown elements', () => {
    const evil =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
      '<script>alert(1)</script>' +
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject>' +
      '<style>*{background:url(https://evil.example/x)}</style>' +
      '<set attributeName="onmouseover" to="alert(1)"/>' +
      '<animate attributeName="href" values="javascript:alert(1)"/>' +
      '<a href="javascript:alert(1)"><path d="M0 0h1v1H0z"/></a>' +
      '<iframe src="javascript:alert(1)"/>' +
      '<path d="M0 0h1v1H0z" fill="#000"/>' +
      '</svg>';
    const out = sanitizeQrSvg(evil)!;
    expect(out).not.toBeNull();
    for (const bad of ['script', 'foreignObject', 'style', '<set', 'animate', '<a ', '<a>', 'iframe', 'javascript', 'onerror', 'alert']) {
      expect(out).not.toContain(bad);
    }
    expect(out).toContain('<path d="M0 0h1v1H0z" fill="#000"/>');
  });

  it('removes event-handler, style and unknown attributes', () => {
    const evil =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">' +
      '<circle cx="1" cy="1" r="1" onclick="alert(2)" style="fill:red" data-x="1"/>' +
      '</svg>';
    const out = sanitizeQrSvg(evil)!;
    expect(out).not.toMatch(/onload|onclick|style=|data-x|alert/);
    expect(out).toContain('<circle cx="1" cy="1" r="1"/>');
  });

  it('drops image hrefs that are not http(s), data:image or same-site paths', () => {
    for (const href of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.example/x.png', 'vbscript:x']) {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">' +
        `<image href="${href.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}" x="0" y="0" width="1" height="1"/>` +
        `<image xlink:href="${href.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}" x="0" y="0" width="1" height="1"/>` +
        '</svg>';
      const out = sanitizeQrSvg(svg)!;
      expect(out).not.toContain('href=');
    }
  });

  it('drops external url() references in presentation attributes but keeps local #id references', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
      '<path d="M0 0" fill="url(https://evil.example/track)"/>' +
      '<image href="https://ok.example/a.png" clip-path="url(#qrLogoClip-abc123)"/>' +
      '</svg>';
    const out = sanitizeQrSvg(svg)!;
    expect(out).not.toContain('evil.example');
    expect(out).toContain('clip-path="url(#qrLogoClip-abc123)"');
  });

  it('escapes text content so it cannot break out when inlined into HTML', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
      '<text x="1" y="1">&lt;/svg&gt;&lt;img src=x onerror=alert(1)&gt;</text>' +
      '<!-- </svg><img src=x onerror=alert(1)> -->' +
      '</svg>';
    const out = sanitizeQrSvg(svg)!;
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<!--');
    const host = document.createElement('div');
    host.innerHTML = out;
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('svg text')?.textContent).toBe('</svg><img src=x onerror=alert(1)>');
  });

  it('rejects anything whose root is not an SVG element', () => {
    expect(sanitizeQrSvg('<img src=x onerror=alert(1)>')).toBeNull();
    expect(sanitizeQrSvg('<html xmlns="http://www.w3.org/1999/xhtml"><body/></html>')).toBeNull();
    expect(sanitizeQrSvg('<svg>not closed')).toBeNull();
    expect(sanitizeQrSvg('<svg><path/></svg>')).toBeNull(); // no SVG namespace
    expect(sanitizeQrSvg('')).toBeNull();
    expect(sanitizeQrSvg('just text')).toBeNull();
  });
});

describe('buildQrPrintHtml', () => {
  const payload = '</h2><script>alert(1)</script><img src=x onerror=alert(1)>';

  it('escapes the business name, slug and URL', () => {
    const html = buildQrPrintHtml({
      slug: `x</title><script>alert('slug')</script>`,
      businessName: payload,
      portalUrl: `https://grumi.pet/"><script>alert(3)</script>/portal`,
      qrSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>',
    })!;
    // The only script is the print trigger.
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).toContain('<script>window.onload = () => window.print();</script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('<h2 style="margin-bottom: 12px;">&lt;/h2&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;</h2>');
    expect(html).toContain('<title>QR x&lt;/title&gt;&lt;script&gt;alert(&#39;slug&#39;)&lt;/script&gt;</title>');
    expect(html).toContain('<p style="margin-bottom: 16px;">https://grumi.pet/&quot;&gt;&lt;script&gt;alert(3)&lt;/script&gt;/portal</p>');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('h2')?.textContent).toBe(payload);
    expect(doc.title).toBe(`QR x</title><script>alert('slug')</script>`);
  });

  it('sanitises the SVG it embeds', () => {
    const html = buildQrPrintHtml({
      slug: 'mi-negocio',
      businessName: 'Mi Negocio',
      portalUrl: 'https://grumi.pet/mi-negocio/portal',
      qrSvg: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><path d="M0 0"/></svg>',
    })!;
    expect(html).not.toContain('alert');
    expect(html).toContain('<path d="M0 0"/>');
  });

  it('returns null when the SVG is not a valid SVG document', () => {
    expect(
      buildQrPrintHtml({ slug: 'a', businessName: 'b', portalUrl: 'c', qrSvg: '<img src=x onerror=alert(1)>' })
    ).toBeNull();
  });

  it('produces the same layout as before for ordinary values', async () => {
    const svg = await generateBusinessPortalQrSvg('mi-negocio', '#123456', 'https://grumi.pet', BRANDING_INITIALS);
    const html = buildQrPrintHtml({
      slug: 'mi-negocio',
      businessName: 'Peluquería Ñandú',
      portalUrl: 'https://grumi.pet/mi-negocio/portal',
      qrSvg: svg,
    })!;
    expect(html).toBe(`
      <html>
        <head><title>QR mi-negocio</title></head>
        <body style="font-family: sans-serif; margin: 24px;">
          <h2 style="margin-bottom: 12px;">Peluquería Ñandú</h2>
          <p style="margin-bottom: 16px;">https://grumi.pet/mi-negocio/portal</p>
          <div style="width: 320px; height: 320px;">${serializeAsParsed(svg)}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
  });
});
