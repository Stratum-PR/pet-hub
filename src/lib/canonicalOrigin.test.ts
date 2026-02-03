import { describe, it, expect, afterEach } from 'vitest';
import { getCanonicalOrigin } from './canonicalOrigin';

describe('getCanonicalOrigin', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('returns localhost when hostname is 127.0.0.1 (avoids OAuth origin mismatch)', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://127.0.0.1:8080', protocol: 'http:', hostname: '127.0.0.1', port: '8080' },
      writable: true,
    });
    expect(getCanonicalOrigin()).toBe('http://localhost:8080');
  });

  it('returns origin unchanged when hostname is localhost', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:8080', protocol: 'http:', hostname: 'localhost', port: '8080' },
      writable: true,
    });
    expect(getCanonicalOrigin()).toBe('http://localhost:8080');
  });

  it('returns origin unchanged for non-local hosts', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://app.example.com', protocol: 'https:', hostname: 'app.example.com', port: '' },
      writable: true,
    });
    expect(getCanonicalOrigin()).toBe('https://app.example.com');
  });
});
