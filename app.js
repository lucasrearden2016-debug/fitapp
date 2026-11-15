import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { generalLimiter } from './middlewares/rateLimit.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import mealPlanRoutes from './routes/mealPlan.routes.js';
import routineRoutes from './routes/routine.routes.js';
import workoutRoutes from './routes/workout.routes.js';

const app = express();

app.set('trust proxy', 1); // Vercel va detrás de proxy (necesario para rate-limit por IP)
const origins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
app.use(cors({ origin: origins.length === 0 || origins.includes('*') ? '*' : origins }));
app.use(express.json({ limit: '1mb' }));

// Conexión a Mongo cacheada (sirve tanto en local como en serverless)
app.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

app.use(generalLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/mealplans', mealPlanRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/workouts', workoutRoutes);

app.use(notFound);
app.use(errorHandler);

// En Vercel NO se hace listen: la función serverless importa `app` desde api/index.js
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`API escuchando en http://localhost:${port}`));
}

export default app;
