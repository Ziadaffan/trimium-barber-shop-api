import router from './api/router';
import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandlerMiddleware } from './api/middlewares/error.handler.middleware';
import { logger } from './packages/common/logger';
import cron from 'node-cron';
import { renewExpiredWatches } from './api/controllers/google.controller';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const configured = process.env.CORS_ORIGINS;
    if (!configured) return callback(null, true);

    const allowed = configured
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (allowed.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY', 'Api-Key', 'X-Signature', 'X-Timestamp'],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(
  morgan(':method :url :status :response-time ms - :remote-addr - :user-agent', {
    stream: {
      write: message => {
        logger.info(message.trim());
      },
    },
  })
);
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.get('/', (req: Request, res: Response) => {
  res.redirect('/health');
});

app.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', router);

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

app.use(errorHandlerMiddleware);

// On Vercel every invocation would register its own timer and die before it ever fires, so the
// schedule there is vercel.json -> GET /api/cron/renew-watches. This is for long-lived servers.
const useInProcessCron = !process.env.VERCEL && process.env.NODE_ENV !== 'test';

if (useInProcessCron) {
  cron.schedule(
    '0 2 * * *',
    async () => {
      try {
        logger.info('Starting scheduled renewExpiredWatches task');
        await renewExpiredWatches();
        logger.info('Successfully completed renewExpiredWatches task');
      } catch (error) {
        logger.error('Failed to renew expired watches:', error);
      }
    },
    {
      timezone: 'America/Montreal',
    }
  );
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running at http://localhost:${PORT} in ${process.env.ENV} mode`);
  });
}

export default app;
