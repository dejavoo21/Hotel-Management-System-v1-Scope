import { HardwareIntegrationType } from '@prisma/client';
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

const smartBuildingTypes: HardwareIntegrationType[] = [HardwareIntegrationType.SMART_DEVICE, HardwareIntegrationType.SMART_GATEWAY];

export const listSmartBuildingDeviceIntegrations = (hotelId: string) =>
  listHardwareIntegrations(hotelId).then((items) =>
    items.filter((item) => smartBuildingTypes.includes(item.integrationType as HardwareIntegrationType))
  );

export const createSmartBuildingDeviceIntegration = (hotelId: string, input: HardwareIntegrationInput) =>
  createHardwareIntegration(hotelId, input);

export const updateSmartBuildingDeviceIntegration = (hotelId: string, id: string, input: Partial<HardwareIntegrationInput>) =>
  updateHardwareIntegration(hotelId, id, input);

export const testSmartBuildingDeviceIntegration = (hotelId: string, id: string) =>
  testHardwareIntegration(hotelId, id);

export const getSmartBuildingDeviceIntegration = (hotelId: string, id: string) =>
  getHardwareIntegration(hotelId, id);

export const getSmartBuildingDeviceIntegrationHealth = (hotelId: string, id: string) =>
  getHardwareIntegrationHealth(hotelId, id);

export const disableSmartBuildingDeviceIntegration = (hotelId: string, id: string) =>
  disableHardwareIntegration(hotelId, id);
