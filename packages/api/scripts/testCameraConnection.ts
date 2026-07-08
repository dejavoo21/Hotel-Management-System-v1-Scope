import { HardwareIntegrationType, HardwareProtocol, HardwareProvider } from '@prisma/client';
import { prisma } from '../src/config/database.js';
import { createCameraIntegration, testCameraIntegration } from '../src/services/cameraIntegration.service.js';

async function main() {
  const hotel = await prisma.hotel.findFirst();
  if (!hotel) throw new Error('No hotel found');

  const camera = await createCameraIntegration(hotel.id, {
    integrationType: HardwareIntegrationType.CCTV_CAMERA,
    name: 'Demo Parking Camera',
    location: 'Parking',
    provider: HardwareProvider.HIKVISION,
    protocol: HardwareProtocol.RTSP,
    host: '192.0.2.20',
    port: 554,
    channelNumber: 1,
    username: 'camera-user',
    secret: 'camera-password',
    streamPath: '/Streaming/Channels/101',
    deviceIdentifier: 'demo-parking-camera',
  });

  const result = await testCameraIntegration(hotel.id, camera.id);
  console.log('Camera connection test complete');
  console.log({
    id: result.id,
    provider: result.provider,
    protocol: result.protocol,
    status: result.status,
    healthStatus: result.healthStatus,
    secretReturned: Boolean((result as any).secretCiphertext),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
