import crypto from 'crypto';

export const hmacHex = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

/** Constant-time comparison that tolerates length mismatches without throwing. */
export const timingSafeEqualString = (a: string, b: string): boolean => {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');

  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

/** Returns the first environment variable that holds a non-empty value. */
export const getSecretFromEnv = (...names: string[]): string | null => {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }

  return null;
};
