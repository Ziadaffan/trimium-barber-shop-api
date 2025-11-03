export const throwError = (message: string, status: number) => {
  const error = new Error(message) as any;
  error.statusCode = status;
  throw error;
};
