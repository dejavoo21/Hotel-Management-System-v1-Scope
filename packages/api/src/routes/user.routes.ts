import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requireAdmin, requireManager, requireModuleAccess } from '../middleware/auth.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    )
    .optional(),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING']),
  sendInvite: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING']).optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),
});

const deleteUserSchema = z.object({
  reason: z.string().min(1, 'Reason is required').optional(),
});

const updatePermissionsSchema = z.object({
  modulePermissions: z.array(z.enum([
    'dashboard', 'bookings', 'rooms', 'messages', 'housekeeping',
    'inventory', 'calendar', 'guests', 'financials', 'reviews',
    'concierge', 'users', 'settings'
  ])),
});

// All routes require authentication and users module access
router.use(authenticate);
router.use(requireModuleAccess('users'));

// Routes
router.get('/', requireManager, userController.getAllUsers);
router.get('/:id', requireManager, userController.getUserById);
router.post('/', requireAdmin, validate(createUserSchema), userController.createUser);
router.patch('/:id', requireAdmin, validate(updateUserSchema), userController.updateUser);
router.patch('/:id/permissions', requireAdmin, validate(updatePermissionsSchema), userController.updateUserPermissions);
router.delete('/:id', requireAdmin, validate(deleteUserSchema), userController.deleteUser);
router.post('/:id/reset-password', requireAdmin, validate(resetPasswordSchema), userController.resetUserPassword);

export default router;
