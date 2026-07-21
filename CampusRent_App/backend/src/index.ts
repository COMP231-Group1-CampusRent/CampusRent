import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import { connectDatabase } from './db';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import listingRoutes from './routes/listings';
import requestRoutes from './routes/requests';
import messageRoutes from './routes/messages';
import reviewRoutes from './routes/reviews';
import reportRoutes from './routes/reports';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CampusRent API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message.includes('images')) {
    return res.status(400).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 CampusRent API running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Unable to connect to MongoDB");
    console.error(error);
    process.exit(1);
  }
}

startServer();