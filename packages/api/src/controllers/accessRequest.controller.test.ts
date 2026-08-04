import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import type { ApiResponse, AuthenticatedRequest } from '../types/index.js';

const prismaMock = vi.hoisted(() => ({
  accessRequest: {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));
const sendEmailMock = vi.hoisted(() => vi.fn());
const auditMock = vi.hoisted(() => vi.fn());

vi.mock('../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../services/email.service.js', () => ({ sendEmail: sendEmailMock }));
vi.mock('../config/index.js', () => ({
  config: {
    appUrl: 'https://laflo.example',
    accessRequestNotifyEmails: [],
    email: { fromAddress: 'onboarding@laflogroup.com' },
  },
}));
vi.mock('../config/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('../services/auth.service.js', () => ({
  createPasswordResetToken: vi.fn().mockResolvedValue('secret-token-not-returned'),
  hashPassword: vi.fn().mockResolvedValue('hash'),
  requestPasswordReset: vi.fn(),
}));
vi.mock('../services/virusScan.service.js', () => ({ scanAttachment: vi.fn() }));
vi.mock('../utils/emailTemplates.js', () => ({
  escapeEmailText: (value: string) => value,
  renderLafloEmail: vi.fn(() => ({ html: '<p>email</p>', text: 'email' })),
}));
vi.mock('../platform/audit/auditEngine.service.js', () => ({ recordAuditEvent: auditMock }));

import {
  approveAccessRequest,
  deleteAccessRequest,
  rejectAccessRequest,
  requestAccessInfo,
} from './accessRequest.controller.js';

function request(overrides: Partial<AuthenticatedRequest> = {}) {
  return {
    params: { id: 'request-1' },
    body: {},
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('vitest'),
    user: {
      id: 'admin-1',
      email: 'admin@laflogroup.com',
      role: 'ADMIN',
      hotelId: 'hotel-1',
      firstName: 'Admin',
      lastName: 'User',
      modulePermissions: ['settings'],
    },
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response<ApiResponse>;
}

const next = vi.fn() as unknown as NextFunction;
const pendingRequest = {
  id: 'request-1',
  fullName: 'New User',
  email: 'new.user@example.com',
  role: 'RECEPTIONIST',
  status: 'PENDING',
  createdAt: new Date(),
};

describe('access request administration safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmailMock.mockResolvedValue(undefined);
    auditMock.mockResolvedValue({ id: 'audit-1' });
    prismaMock.accessRequest.findFirst.mockResolvedValue(pendingRequest);
    prismaMock.accessRequest.update.mockResolvedValue({ ...pendingRequest, status: 'APPROVED' });
    prismaMock.accessRequest.delete.mockResolvedValue(pendingRequest);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: pendingRequest.email,
      modulePermissions: [],
    });
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', email: pendingRequest.email });
  });

  it('blocks an administrator from approving their own elevated request', async () => {
    prismaMock.accessRequest.findFirst.mockResolvedValue({ ...pendingRequest, email: 'admin@laflogroup.com' });
    const req = request({ body: { role: 'ADMIN' } } as Partial<AuthenticatedRequest>);
    const res = response();

    await approveAccessRequest(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it('creates a backend audit record when approving and resending setup', async () => {
    const res = response();
    await approveAccessRequest(request({ body: { role: 'RECEPTIONIST' } } as Partial<AuthenticatedRequest>), res, next);

    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ACCESS_REQUEST_APPROVED',
      entity: 'ACCESS_REQUEST',
      entityId: 'request-1',
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ token: expect.anything() }),
    }));

    auditMock.mockClear();
    prismaMock.accessRequest.findFirst.mockResolvedValue({ ...pendingRequest, status: 'APPROVED' });
    await approveAccessRequest(request({ body: { role: 'RECEPTIONIST' } } as Partial<AuthenticatedRequest>), response(), next);
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACCESS_REQUEST_SETUP_RESENT' }));
  });

  it.each([
    ['reject', rejectAccessRequest, 'ACCESS_REQUEST_REJECTED', { notes: 'Not eligible' }],
    ['request info', requestAccessInfo, 'ACCESS_REQUEST_INFO_REQUESTED', { notes: 'Proof required' }],
    ['delete', deleteAccessRequest, 'ACCESS_REQUEST_DELETED', {}],
  ])('records %s actions in the backend audit trail', async (_label, handler, action, body) => {
    await handler(request({ body } as Partial<AuthenticatedRequest>), response(), next);
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({ action, entityId: 'request-1' }));
  });
});
