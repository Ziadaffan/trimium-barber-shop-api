import { describe, expect, it } from 'vitest';

import { getSecretFromEnv, hmacHex, timingSafeEqualString } from '../../src/packages/common/utils/hmac.utils';
import { buildSignaturePayload, signApiRequest } from '../../src/api/middlewares/auth.middleware';

describe('hmacHex', () => {
  it('is deterministic and secret dependent', () => {
    expect(hmacHex('payload', 'secret')).toBe(hmacHex('payload', 'secret'));
    expect(hmacHex('payload', 'secret')).not.toBe(hmacHex('payload', 'other-secret'));
    expect(hmacHex('payload', 'secret')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('timingSafeEqualString', () => {
  it('compares content and never throws on a length mismatch', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualString('', '')).toBe(true);
    expect(timingSafeEqualString('abc', '')).toBe(false);
  });

  it('handles multi byte characters without throwing', () => {
    expect(timingSafeEqualString('réservé', 'réservé')).toBe(true);
    expect(timingSafeEqualString('réservé', 'reserve')).toBe(false);
  });
});

describe('getSecretFromEnv', () => {
  it('returns the first variable that holds a value', () => {
    process.env.FIRST_SECRET = '';
    process.env.SECOND_SECRET = 'value';

    expect(getSecretFromEnv('FIRST_SECRET', 'SECOND_SECRET')).toBe('value');
    expect(getSecretFromEnv('MISSING_A', 'MISSING_B')).toBeNull();

    delete process.env.FIRST_SECRET;
    delete process.env.SECOND_SECRET;
  });
});

describe('request signatures', () => {
  it('binds the signature to method, url and timestamp', () => {
    const secret = 'test-api-secret';
    const base = signApiRequest('GET', '/api/reservations', 1_700_000_000_000, secret);

    expect(signApiRequest('get', '/api/reservations', 1_700_000_000_000, secret)).toBe(base);
    expect(signApiRequest('POST', '/api/reservations', 1_700_000_000_000, secret)).not.toBe(base);
    expect(signApiRequest('GET', '/api/barbers', 1_700_000_000_000, secret)).not.toBe(base);
    expect(signApiRequest('GET', '/api/reservations', 1_700_000_000_001, secret)).not.toBe(base);
    expect(signApiRequest('GET', '/api/reservations', 1_700_000_000_000, 'other')).not.toBe(base);
  });

  it('keeps the payload shape the existing clients already sign', () => {
    expect(buildSignaturePayload('get', '/api/x', '123')).toBe('GET\n/api/x\n123');
  });
});
