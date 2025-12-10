import 'module-alias/register';
import router from './api/router';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandlerMiddleware } from './api/middlewares/error.handler.middleware';
import prisma from './packages/lib/db';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT} in ${process.env.ENV} mode`);
});

export default app;
