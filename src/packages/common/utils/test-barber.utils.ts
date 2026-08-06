export const TEST_BARBER_NAME = 'test';

export const isLocalEnv = (): boolean => process.env.ENV === 'local';

/**
 * Prisma filter that hides the test barber outside of the local environment.
 * Returns `undefined` locally so the test barber stays visible while developing.
 */
export const hiddenTestBarberFilter = () =>
  isLocalEnv() ? undefined : { NOT: { name: { equals: TEST_BARBER_NAME, mode: 'insensitive' as const } } };
