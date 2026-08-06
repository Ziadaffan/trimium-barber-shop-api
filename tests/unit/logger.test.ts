import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The logger used to build a Logtail client unconditionally, and Logtail throws on an empty
 * token, so a deploy without TELEMETRY_SOURCE_TOKEN crashed on import.
 */
describe('logger', () => {
  const original = {
    ENV: process.env.ENV,
    NODE_ENV: process.env.NODE_ENV,
    token: process.env.TELEMETRY_SOURCE_TOKEN,
    endpoint: process.env.TELEMETRY_ENDPOINT,
  };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.ENV = original.ENV;
    process.env.NODE_ENV = original.NODE_ENV;

    if (original.token === undefined) delete process.env.TELEMETRY_SOURCE_TOKEN;
    else process.env.TELEMETRY_SOURCE_TOKEN = original.token;

    if (original.endpoint === undefined) delete process.env.TELEMETRY_ENDPOINT;
    else process.env.TELEMETRY_ENDPOINT = original.endpoint;
  });

  it('imports without telemetry configured in a production-like environment', async () => {
    process.env.ENV = 'production';
    process.env.NODE_ENV = 'production';
    delete process.env.TELEMETRY_SOURCE_TOKEN;

    const { logger } = await import('../../src/packages/common/logger');

    expect(logger.transports).toHaveLength(1);
    expect(() => logger.info('still usable')).not.toThrow();
  });

  it('imports with a telemetry token but no endpoint configured', async () => {
    process.env.ENV = 'production';
    process.env.NODE_ENV = 'production';
    process.env.TELEMETRY_SOURCE_TOKEN = 'a-token';
    delete process.env.TELEMETRY_ENDPOINT;

    const { logger } = await import('../../src/packages/common/logger');

    expect(logger.transports).toHaveLength(1);
  });

  it('imports with both telemetry variables configured', async () => {
    process.env.ENV = 'production';
    process.env.NODE_ENV = 'production';
    process.env.TELEMETRY_SOURCE_TOKEN = 'a-token';
    process.env.TELEMETRY_ENDPOINT = 'https://in.logs.betterstack.test';

    const { logger } = await import('../../src/packages/common/logger');

    expect(logger.transports).toHaveLength(1);
  });

  it('logs to the console in local development', async () => {
    process.env.ENV = 'dev';
    process.env.NODE_ENV = 'development';
    delete process.env.TELEMETRY_SOURCE_TOKEN;

    const { logger } = await import('../../src/packages/common/logger');

    expect(logger.transports).toHaveLength(1);
    expect(() => logger.error(new Error('boom'))).not.toThrow();
  });

  it('stays silent under test so suites do not print noise', async () => {
    process.env.ENV = 'test';
    process.env.NODE_ENV = 'test';

    const { logger } = await import('../../src/packages/common/logger');

    expect((logger.transports[0] as { silent?: boolean }).silent).toBe(true);
  });
});
