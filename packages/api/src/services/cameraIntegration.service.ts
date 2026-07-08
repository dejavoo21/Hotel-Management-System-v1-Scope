import { HardwareIntegrationType, type HardwareIntegration } from '@prisma/client';
import {
  createHardwareIntegration,
  disableHardwareIntegration,
  getHardwareIntegration,
  getHardwareIntegrationHealth,
  listHardwareIntegrations,
  testHardwareIntegration,
  updateHardwareIntegration,
  type HardwareIntegrationInput,
} from './hardwareIntegration.service.js';

const cctvTypes: HardwareIntegrationType[] = [HardwareIntegrationType.CCTV_CAMERA, HardwareIntegrationType.CCTV_NVR];

export const listCameraIntegrations = (hotelId: string) =>
  listHardwareIntegrations(hotelId).then((items) =>
    items.filter((item) => cctvTypes.includes(item.integrationType as HardwareIntegrationType))
  );

export const createCameraIntegration = (hotelId: string, input: HardwareIntegrationInput) =>
  createHardwareIntegration(hotelId, input);

export const updateCameraIntegration = (hotelId: string, id: string, input: Partial<HardwareIntegrationInput>) =>
  updateHardwareIntegration(hotelId, id, input);

export const testCameraIntegration = (hotelId: string, id: string) =>
  testHardwareIntegration(hotelId, id);

export const getCameraIntegration = (hotelId: string, id: string) =>
  getHardwareIntegration(hotelId, id) as Promise<Omit<HardwareIntegration, 'secretCiphertext'> & { hasSecret: boolean }>;

export const getCameraIntegrationHealth = (hotelId: string, id: string) =>
  getHardwareIntegrationHealth(hotelId, id);

export const disableCameraIntegration = (hotelId: string, id: string) =>
  disableHardwareIntegration(hotelId, id);
