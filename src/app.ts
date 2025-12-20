import router from './api/router';
import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandlerMiddleware } from './api/middlewares/error.handler.middleware';

dotenv.config();

const app: Application = express();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Non-browser clients (curl, server-to-server) often don't send Origin
    if (!origin) return callback(null, true);

    const configured = process.env.CORS_ORIGINS;
    // If not configured, allow all origins (keeps current behavior functional)
    if (!configured) return callback(null, true);

    const allowed = configured
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (allowed.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY', 'Api-Key'],
};

app.use(helmet());
app.use(cors(corsOptions));
// Ensure preflight requests are handled
app.options('*', cors(corsOptions));

app.use(morgan('combined'));
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

export default app;
