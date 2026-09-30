import { describe, it, expect } from 'vitest';
import { isAuthorizedCron } from './_cron-auth.js';

describe('isAuthorizedCron', () => {
  it('accepts the exact bearer secret', () => {
    expect(isAuthorizedCron('Bearer s3cret', 's3cret')).toBe(true);
  });

  it('fails CLOSED when the secret is unset -- the preview-deployment hole (undefined === undefined)', () => {
    expect(isAuthorizedCron(undefined, undefined)).toBe(false);
    expect(isAuthorizedCron('Bearer anything', undefined)).toBe(false);
  });

  it('fails closed when the secret is an empty string, even against a bare "Bearer " header', () => {
    expect(isAuthorizedCron('Bearer ', '')).toBe(false);
    expect(isAuthorizedCron('Bearer x', '')).toBe(false);
  });

  it('rejects a missing header, a wrong secret, a wrong-length secret, and a non-Bearer scheme', () => {
    expect(isAuthorizedCron(undefined, 's3cret')).toBe(false);
    expect(isAuthorizedCron('Bearer wrong!', 's3cret')).toBe(false);
    expect(isAuthorizedCron('Bearer s3cret-and-more', 's3cret')).toBe(false);
    expect(isAuthorizedCron('s3cret', 's3cret')).toBe(false); // the old code also accepted a bare secret
    expect(isAuthorizedCron('Basic s3cret', 's3cret')).toBe(false);
  });

  it('defaults to process.env.CRON_SECRET', () => {
    const prev = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      expect(isAuthorizedCron('Bearer x')).toBe(false);
      process.env.CRON_SECRET = 'from-env';
      expect(isAuthorizedCron('Bearer from-env')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev;
    }
  });
});
