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

/**
 * CampusRent Backend API
 *
 * Main entry point for the Express server.
 *
 * Responsibilities:
 * - Load environment variables.
 * - Configure CORS.
 * - Parse JSON request bodies.
 * - Serve uploaded files.
 * - Register API routes.
 * - Connect to MongoDB.
 * - Start the Express server.
 * - Handle application errors.
 * - Gracefully close the database connection when the server stops.
 */

// ---------------------------------------------------------
// Environment Configuration
// ---------------------------------------------------------

// Load environment variables from backend/.env when running locally.
// In production, environment variables will be provided by the
// hosting service, such as Render.
dotenv.config();

const app = express();

/**
 * Read the server port from the environment.
 *
 * Render provides its own PORT value automatically.
 * When running locally, the application defaults to port 5000.
 */
const parsedPort = Number.parseInt(process.env.PORT ?? '5000', 10);
const PORT = Number.isNaN(parsedPort) ? 5000 : parsedPort;

// ---------------------------------------------------------
// CORS Configuration
// ---------------------------------------------------------

/**
 * Defines which frontend applications are allowed to access
 * the CampusRent backend API.
 *
 * Localhost addresses are used during local development.
 *
 * FRONTEND_URL will be configured in the production environment
 * after the frontend application has been deployed.
 */
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ---------------------------------------------------------
// Express Middleware
// ---------------------------------------------------------

/**
 * Parse incoming JSON request bodies.
 */
app.use(express.json());

/**
 * Make uploaded images and files publicly accessible through:
 *
 * /uploads/<filename>
 *
 * Example:
 * http://localhost:5000/uploads/image.jpg
 */
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'))
);

// ---------------------------------------------------------
// Health Check
// ---------------------------------------------------------

/**
 * Basic health-check endpoint.
 *
 * This route can be used locally or by a hosting service
 * to verify that the CampusRent backend is running.
 *
 * GET /api/health
 */
app.get('/api/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    service: 'CampusRent API',
    port: PORT,
  });
});

// ---------------------------------------------------------
// API Routes
// ---------------------------------------------------------

/**
 * Authentication routes.
 *
 * Examples:
 * POST /api/auth/register
 * POST /api/auth/login
 */
app.use('/api/auth', authRoutes);

/**
 * User-management routes.
 */
app.use('/api/users', userRoutes);

/**
 * Listing-management routes.
 */
app.use('/api/listings', listingRoutes);

/**
 * Rental-request routes.
 */
app.use('/api/requests', requestRoutes);

/**
 * Messaging and conversation routes.
 */
app.use('/api/conversations', messageRoutes);

/**
 * Rating and review routes.
 */
app.use('/api/reviews', reviewRoutes);

/**
 * User and listing report routes.
 */
app.use('/api/reports', reportRoutes);

/**
 * Administrative routes.
 */
app.use('/api/admin', adminRoutes);

// ---------------------------------------------------------
// 404 Handler
// ---------------------------------------------------------

/**
 * Handles requests to routes that do not exist.
 *
 * This middleware must appear after all valid API routes.
 */
app.use((_req: Request, res: Response) => {
  return res.status(404).json({
    error: 'Route not found',
  });
});

// ---------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------

/**
 * Central error-handling middleware.
 *
 * Express identifies an error middleware by the four parameters:
 * error, request, response, and next.
 */
app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error('Unhandled API error:', err);

    /**
     * Some image-validation errors are treated as client errors
     * rather than internal server errors.
     */
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

// ---------------------------------------------------------
// Server Startup
// ---------------------------------------------------------

/**
 * Connect to MongoDB before starting the HTTP server.
 *
 * The application listens on 0.0.0.0 so that it can accept
 * external connections when deployed to a hosting service.
 */
async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`CampusRent API running on port ${PORT}`);
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

// ---------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------

/**
 * Gracefully close the MongoDB connection when the Node.js
 * process receives a termination signal.
 *
 * SIGINT:
 * Usually generated when stopping the application manually
 * with Ctrl+C.
 *
 * SIGTERM:
 * Commonly used by hosting platforms when stopping or
 * restarting an application.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}. Shutting down...`);

  try {
    await disconnectDatabase();

    console.log('MongoDB connection closed.');

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

// Start the CampusRent backend.
void startServer();