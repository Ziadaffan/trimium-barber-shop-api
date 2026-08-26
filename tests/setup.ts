// Deterministic, offline environment for every test file.
process.env.NODE_ENV = 'test';
process.env.ENV = 'test';

// No real database is ever reached: src/packages/lib/db is mocked in the tests that need it.
// This value only keeps the Prisma constructor happy if something imports it by accident.
process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5499/nowhere';

process.env.API_SECRET = 'test-api-secret';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PUBLIC_API_URL = 'https://api.trimium.test';
process.env.SHOP_NAME = 'Trimium';
process.env.SHOP_ADDRESS = '123 Rue Sainte-Catherine, Montréal, QC';
process.env.SHOP_PHONE = '+1 514 555 0199';

delete process.env.TELEMETRY_SOURCE_TOKEN;
delete process.env.TELEMETRY_ENDPOINT;
delete process.env.VERCEL;
delete process.env.VERCEL_URL;
delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
delete process.env.RESERVATION_CANCEL_SECRET;
delete process.env.CRON_SECRET;
