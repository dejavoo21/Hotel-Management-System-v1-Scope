import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma, disconnectDatabase, checkDatabaseHealth } from './config/database.js';
import { logger } from './config/logger.js';
import { setupSocketHandlers } from './socket/index.js';
import { startImapPolling } from './services/imap.service.js';

const isDemoMode = !config.databaseUrl || process.env.DEMO_MODE === 'true';

// Module-level io reference for getIo() export
let ioInstance: SocketIOServer | null = null;

/**
 * Get the Socket.IO server instance
 * Used by controllers to broadcast events
 */
export function getIo(): SocketIOServer | null {
  return ioInstance;
}

async function startServer(): Promise<void> {
  try {
    if (isDemoMode) {
      logger.info('Starting in DEMO MODE (no database required)');
    } else {
      const dbHealthy = await checkDatabaseHealth();
      if (!dbHealthy) {
        logger.warn('Database connection failed, switching to DEMO MODE');
      } else {
        logger.info('Database connection established');
      }
    }

    const app = createApp();
    const httpServer = http.createServer(app);

    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    setupSocketHandlers(io);
    logger.info('Socket.IO initialized');

    // Store io instance for getIo() export
    ioInstance = io;
    app.set('io', io);

    httpServer.listen(config.port, () => {
      logger.info(`HotelOS API running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API URL: ${config.apiUrl}`);
      logger.info(`Health check: ${config.apiUrl}/health`);
    });

    startImapPolling().catch((error) => {
      logger.error('Failed to start IMAP polling', error);
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully...`);

      httpServer.close(async () => {
        logger.info('HTTP server closed');

        io.close(() => {
          logger.info('Socket.IO server closed');
        });

        await disconnectDatabase();
        logger.info('Database disconnected');

        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

startServer();

export { prisma };
