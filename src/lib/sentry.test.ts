import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { scrubBreadcrumb, scrubDeep, scrubEvent, scrubText, sentryEnvironment } from './sentry';

describe('scrubText', () => {
  it('replaces email addresses', () => {
    expect(scrubText('No client for maria.lopez+tag@gmail.com in business x')).toBe(
      'No client for [email] in business x',
    );
  });

  it('replaces phone numbers in common formats', () => {
    expect(scrubText('call (787) 555-0100 or 787-555-0101 or +1 787 555 0102')).toBe(
      'call [phone] or [phone] or [phone]',
    );
  });

  it('keeps ids, dates and short numbers', () => {
    const s = 'appointment d3e07a9c-7c8e-4415-a7c3-ff1cd556181a on 2026-10-17 total 45.00 PIN 3412';
    expect(scrubText(s)).toBe(s);
  });
});

describe('scrubDeep', () => {
  it('scrubs nested strings and leaves other values', () => {
    expect(scrubDeep({ a: ['x@y.com', 3, null], b: { c: '7875550100', d: true } })).toEqual({
      a: ['[email]', 3, null],
      b: { c: '[phone]', d: true },
    });
  });
});

describe('scrubEvent', () => {
  it('drops the user, cookies, headers and request body and scrubs messages', () => {
    const event = {
      type: undefined,
      message: 'failed for pat@example.com',
      user: { id: 'u1', email: 'pat@example.com' },
      request: { url: 'https://grumi.pet/x?email=pat@example.com', cookies: { a: 'b' }, headers: { h: 'v' }, data: '{}' },
      exception: { values: [{ type: 'Error', value: 'Duplicate phone (787) 555-0100' }] },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event)!;
    expect(out.user).toBeUndefined();
    expect(out.request).toEqual({ url: 'https://grumi.pet/x?email=[email]' });
    expect(out.message).toBe('failed for [email]');
    expect(out.exception?.values?.[0].value).toBe('Duplicate phone [phone]');
  });

  it('drops AbortErrors', () => {
    const event = { type: undefined, exception: { values: [{ type: 'AbortError', value: 'signal is aborted' }] } } as unknown as ErrorEvent;
    expect(scrubEvent(event)).toBeNull();
  });
});

describe('scrubBreadcrumb', () => {
  it('keeps only the scrubbed message of console breadcrumbs', () => {
    expect(
      scrubBreadcrumb({ category: 'console', message: 'saved a@b.co', data: { arguments: [{ email: 'a@b.co' }] } }),
    ).toEqual({ category: 'console', message: 'saved [email]', data: undefined });
  });

  it('scrubs navigation and fetch breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'navigation', data: { to: '/portal?email=a@b.co' } })).toEqual({
      category: 'navigation',
      data: { to: '/portal?email=[email]' },
    });
  });
});

describe('sentryEnvironment', () => {
  it('is off on localhost and maps the Grumi hosts', () => {
    expect(sentryEnvironment('localhost')).toBeNull();
    expect(sentryEnvironment('127.0.0.1')).toBeNull();
    expect(sentryEnvironment('grumi.pet')).toBe('production');
    expect(sentryEnvironment('www.grumi.pet')).toBe('production');
    expect(sentryEnvironment('dev.grumi.pet')).toBe('dev');
    expect(sentryEnvironment('pet-hub-git-x.vercel.app')).toBe('preview');
  });
});
