import express, { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { requestLoggerFormat, logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { checkClamAvHealth } from './services/virusScan.service.js';

// Check demo mode
const isDemoMode = !config.databaseUrl || process.env.DEMO_MODE === 'true';

// Import routes (conditionally)
import demoRoutes from './demo/demoRoutes.js';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import roomRoutes from './routes/room.routes.js';
import roomTypeRoutes from './routes/roomType.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import guestRoutes from './routes/guest.routes.js';
import housekeepingRoutes from './routes/housekeeping.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import userRoutes from './routes/user.routes.js';
import reportRoutes from './routes/report.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import reviewRoutes from './routes/review.routes.js';
import conciergeRoutes from './routes/concierge.routes.js';
import hotelRoutes from './routes/hotel.routes.js';
import messageRoutes from './routes/message.routes.js';
import accessRequestRoutes from './routes/accessRequest.routes.js';
import purchaseOrderRoutes from './routes/purchaseOrder.routes.js';
import floorRoutes from './routes/floor.routes.js';
import callRoutes from './routes/call.routes.js';
import weatherSignalRoutes from './routes/weatherSignal.routes.js';
import jobRoutes from './routes/job.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import aiHooksRoutes from './routes/aiHooks.routes.js';

const normalizeOrigin = (value?: string): string | undefined =>
  value ? value.replace(/\/+$/, '') : undefined;

const normalizedCorsOrigins = new Set(
  (Array.isArray(config.cors.origin) ? config.cors.origin : [config.cors.origin])
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin))
);

export function createApp(): Application {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

  const corsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestOrigin = req.headers.origin;
    const normalized = normalizeOrigin(requestOrigin);
    const isAllowed = Boolean(normalized && normalizedCorsOrigins.has(normalized));

    if (requestOrigin && isAllowed) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Headers', ['Content-Type', 'Authorization', 'X-Requested-With'].join(','));
      res.header('Access-Control-Allow-Methods', allowedMethods.join(','));
    }

    if (isAllowed && req.method === 'OPTIONS') {
      res.header('Content-Length', '0');
      res.status(204).end();
      return;
    }

    next();
  };

  app.use(corsMiddleware);

  // Rate limiting
  const authPaths = new Set([
    '/auth/login',
    '/auth/verify-code',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
  ]);

  const authLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: 25,
    message: { success: false, error: 'Too many auth attempts. Please wait and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: Math.max(config.rateLimit.max, 1200),
    message: { success: false, error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => authPaths.has(req.path),
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  if (config.nodeEnv !== 'test') {
    app.use(morgan(requestLoggerFormat, {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }));
  }

  // Root route - API info
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'LaFlo Hotel Management System API',
        version: '1.0.0',
        status: 'running',
        mode: isDemoMode ? 'demo' : 'production',
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          dashboard: '/api/dashboard',
          rooms: '/api/rooms',
          bookings: '/api/bookings',
          guests: '/api/guests',
          accessRequests: '/api/access-requests',
        },
        documentation: 'https://github.com/dejavoo21/Hotel-Management-System-v1-Scope',
      },
    });
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
      },
    });
  });

  app.get('/health/clamav', async (_req, res) => {
    const result = await checkClamAvHealth();
    if (result.status === 'disabled') {
      res.json({ success: true, data: { status: 'disabled' } });
      return;
    }
    if (result.status === 'ok') {
      res.json({ success: true, data: { status: 'ok', version: result.version } });
      return;
    }
    res.status(503).json({ success: false, error: result.output, data: { status: 'error' } });
  });

  // API Routes
  if (isDemoMode) {
    // Use demo routes (no database required)
    app.use('/api', demoRoutes);
    logger.info('🎭 Using DEMO routes (mock data)');
  } else {
    // Use real routes with database
    app.use('/api/auth', authRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/rooms', roomRoutes);
    app.use('/api/room-types', roomTypeRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/guests', guestRoutes);
    app.use('/api/housekeeping', housekeepingRoutes);
    app.use('/api/invoices', invoiceRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/inventory', inventoryRoutes);
    app.use('/api/calendar', calendarRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.use('/api/concierge', conciergeRoutes);
    app.use('/api/hotels', hotelRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/access-requests', accessRequestRoutes);
    app.use('/api/floors', floorRoutes);
    app.use('/api/purchase-orders', purchaseOrderRoutes);
    app.use('/api/calls', callRoutes);
    app.use('/api/signals/weather', weatherSignalRoutes);
    app.use('/api/jobs', jobRoutes);
    app.use('/api/tickets', ticketRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/ai', aiHooksRoutes);
  }

  // API documentation endpoint
  app.get('/api', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'HotelOS API',
        version: '1.0.0',
        documentation: '/api/docs',
        health: '/health',
        healthClamav: '/health/clamav',
        endpoints: {
          auth: '/api/auth',
          dashboard: '/api/dashboard',
          rooms: '/api/rooms',
          roomTypes: '/api/room-types',
          bookings: '/api/bookings',
          guests: '/api/guests',
          housekeeping: '/api/housekeeping',
          invoices: '/api/invoices',
          users: '/api/users',
          reports: '/api/reports',
          payments: '/api/payments',
          inventory: '/api/inventory',
          calendar: '/api/calendar',
          reviews: '/api/reviews',
          concierge: '/api/concierge',
          hotels: '/api/hotels',
          messages: '/api/messages',
          accessRequests: '/api/access-requests',
          purchaseOrders: '/api/purchase-orders',
          calls: '/api/calls',
          weatherSignals: '/api/signals/weather',
        },
      },
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

export default createApp;
