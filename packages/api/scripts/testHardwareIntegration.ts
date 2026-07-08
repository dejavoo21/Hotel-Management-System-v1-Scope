import { HardwareIntegrationType, HardwareProtocol, HardwareProvider } from '@prisma/client';
import { prisma } from '../src/config/database.js';
import {
  createHardwareIntegration,
  listHardwareIntegrations,
  testHardwareIntegration,
} from '../src/services/hardwareIntegration.service.js';

async function main() {
  const hotel = await prisma.hotel.findFirst();
  if (!hotel) throw new Error('No hotel found');

  const integration = await createHardwareIntegration(hotel.id, {
    integrationType: HardwareIntegrationType.CCTV_CAMERA,
    name: 'Demo Lobby Camera',
    location: 'Lobby',
    provider: HardwareProvider.ONVIF,
    protocol: HardwareProtocol.ONVIF,
    host: '192.0.2.10',
    port: 80,
    username: 'demo-user',
    secret: 'demo-password',
    deviceIdentifier: 'demo-lobby-camera',
  });

  const tested = await testHardwareIntegration(hotel.id, integration.id);
  const list = await listHardwareIntegrations(hotel.id);

  console.log('Hardware integration test complete');
  console.log({
    createdId: integration.id,
    status: tested.status,
    healthStatus: tested.healthStatus,
    integrations: list.length,
    secretReturned: Boolean((tested as any).secretCiphertext),
    secretMasked: tested.secretMasked,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
