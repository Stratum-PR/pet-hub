import { afterEach, describe, expect, it } from 'vitest';
import { generateBusinessPortalQrSvg } from './qrCode';

// The build targets Safari 12 / iOS 12, which have no String.prototype.replaceAll (added in Safari 13.1), and Vite
// only lowers syntax, not built-in methods. Simulate that browser. (The method isn't in this project's ES2020 lib
// types either, hence the typed view of the prototype.)
const stringProto = String.prototype as unknown as { replaceAll?: unknown };
const nativeReplaceAll = stringProto.replaceAll;

describe('generateBusinessPortalQrSvg', () => {
  afterEach(() => {
    stringProto.replaceAll = nativeReplaceAll;
  });

  it('escapes the logo URL for XML, even without String.prototype.replaceAll (Safari 12)', async () => {
    delete stringProto.replaceAll;
    const svg = await generateBusinessPortalQrSvg('mi-negocio', '#123456', 'https://grumi.pet', {
      businessName: 'Mi Negocio',
      logoUrl: 'https://cdn.example.com/logo.png?a=1&b="2"<x>',
    });
    expect(svg).toContain('href="https://cdn.example.com/logo.png?a=1&amp;b=&quot;2&quot;&lt;x&gt;"');
  });
});
