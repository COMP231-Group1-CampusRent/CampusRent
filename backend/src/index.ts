import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import { connectDatabase, disconnectDatabase } from './db';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import listingRoutes from './routes/listings';
import requestRoutes from './routes/requests';
import messageRoutes from './routes/messages';
import reviewRoutes from './routes/reviews';
import reportRoutes from './routes/reports';
import adminRoutes from './routes/admin';

// Load environment variables from backend/.env.
dotenv.config();

const app = express();

const parsedPort = Number.parseInt(process.env.PORT ?? '5000', 10);
const PORT = Number.isNaN(parsedPort) ? 5000 : parsedPort;

// Allow requests from the local Vite frontend.
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  })
);

// Parse JSON request bodies.
app.use(express.json());

// Serve uploaded images and files.
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'))
);

// Basic backend health check.
app.get('/api/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    service: 'CampusRent API',
    port: PORT,
  });
});

// API routes.
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// Handle requests made to routes that do not exist.
app.use((_req: Request, res: Response) => {
  return res.status(404).json({
    error: 'Route not found',
  });
});

// Central error-handling middleware.
app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error('Unhandled API error:', err);

    if (err.message.toLowerCase().includes('images')) {
      return res.status(400).json({
        error: err.message,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
);

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(
        `CampusRent API running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error('Unable to start the CampusRent backend.');

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

// Close the MongoDB connection when the server is stopped.
async function shutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}. Shutting down...`);

  try {
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Error while shutting down:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void startServer();