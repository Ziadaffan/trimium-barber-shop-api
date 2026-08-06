import { vi } from 'vitest';

/**
 * Hand-rolled Prisma double. Every method a controller touches is a vi.fn() so a test that
 * forgets to stub something fails loudly instead of silently hitting a real database.
 */
export const createPrismaMock = () => ({
  reservation: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  barber: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  service: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  barberSchedule: {
    findMany: vi.fn(),
  },
  barberTimeOff: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  googleCalendarToken: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  googleCalendarWatch: {
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  comment: { findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
  product: { findMany: vi.fn() },
  gallery: { findMany: vi.fn() },
});

export type PrismaMock = ReturnType<typeof createPrismaMock>;

export const prismaMock: PrismaMock = createPrismaMock();

export const resetPrismaMock = () => {
  for (const model of Object.values(prismaMock)) {
    for (const method of Object.values(model)) {
      (method as ReturnType<typeof vi.fn>).mockReset();
    }
  }
};
