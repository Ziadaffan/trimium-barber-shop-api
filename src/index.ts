import app from './app';
const PORT = process.env.PORT || 3000;

// Local dev/prod (non-serverless) entry:
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT} in ${process.env.ENV} mode`);
  });
}

export default app;
