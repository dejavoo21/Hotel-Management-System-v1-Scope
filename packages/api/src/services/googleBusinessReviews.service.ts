import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';

const PROVIDER = 'GOOGLE_BUSINESS_PROFILE';
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

function encryptionKey() {
  return crypto.createHash('sha256').update(process.env.INTEGRATION_SECRET_KEY || config.jwt.secret).digest();
}

function encrypt(value?: string | null) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(value?: string | null) {
  if (!value) return null;
  const [iv, tag, encrypted] = value.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

export function googleRedirectUri() {
  return config.reviewIntegrations.google.redirectUri || `${config.apiUrl.replace(/\/$/, '')}/api/integration-manager/review-platforms/google/callback`;
}

export function getGoogleConnectorConfiguration() {
  const credentialsConfigured = Boolean(config.reviewIntegrations.google.clientId && config.reviewIntegrations.google.clientSecret);
  return {
    provider: PROVIDER,
    credentialsConfigured,
    redirectUri: googleRedirectUri(),
    requiredScope: SCOPE,
    setupMessage: credentialsConfigured
      ? 'Google OAuth credentials are configured. Connect a Business Profile account to select a location and sync reviews.'
      : 'Add GOOGLE_BUSINESS_CLIENT_ID and GOOGLE_BUSINESS_CLIENT_SECRET before connecting Google.',
  };
}

export async function getGoogleConnection(hotelId: string) {
  const connection = await prisma.reviewProviderConnection.findUnique({ where: { hotelId_provider: { hotelId, provider: PROVIDER } } });
  return {
    ...getGoogleConnectorConfiguration(),
    status: connection?.status || 'NOT_CONNECTED',
    accountName: connection?.accountName || null,
    locationName: connection?.locationName || null,
    lastSyncAt: connection?.lastSyncAt || null,
    lastError: connection?.lastError || null,
  };
}

export function createGoogleAuthorizationUrl(hotelId: string, userId: string) {
  if (!config.reviewIntegrations.google.clientId || !config.reviewIntegrations.google.clientSecret) {
    throw new Error('Google Business Profile OAuth credentials are not configured.');
  }
  const state = jwt.sign({ hotelId, userId, provider: PROVIDER }, config.jwt.secret, { expiresIn: '10m' });
  const query = new URLSearchParams({
    client_id: config.reviewIntegrations.google.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

async function googleJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Google API request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

async function discoverProfile(accessToken: string) {
  const accounts = await googleJson<{ accounts?: Array<{ name: string; accountName?: string }> }>('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', accessToken);
  const account = accounts.accounts?.[0];
  if (!account) throw new Error('No Google Business Profile account is available to this Google user.');
  const locationsUrl = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`);
  locationsUrl.searchParams.set('readMask', 'name,title,storefrontAddress');
  const locations = await googleJson<{ locations?: Array<{ name: string; title?: string; storefrontAddress?: { regionCode?: string } }> }>(locationsUrl.toString(), accessToken);
  const location = locations.locations?.[0];
  if (!location) throw new Error('No Google Business Profile location is available to this account.');
  return { account, location };
}

export async function completeGoogleAuthorization(code: string, state: string) {
  const payload = jwt.verify(state, config.jwt.secret) as { hotelId: string; userId: string; provider: string };
  if (payload.provider !== PROVIDER) throw new Error('Invalid review connector state.');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.reviewIntegrations.google.clientId,
      client_secret: config.reviewIntegrations.google.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || 'Google OAuth token exchange failed.');
  const profile = await discoverProfile(tokens.access_token);
  await prisma.reviewProviderConnection.upsert({
    where: { hotelId_provider: { hotelId: payload.hotelId, provider: PROVIDER } },
    create: {
      hotelId: payload.hotelId,
      provider: PROVIDER,
      status: 'CONNECTED',
      accessTokenCiphertext: encrypt(tokens.access_token),
      refreshTokenCiphertext: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      accountName: profile.account.name,
      locationName: profile.location.name,
      metadata: { accountLabel: profile.account.accountName, locationLabel: profile.location.title, country: profile.location.storefrontAddress?.regionCode },
    },
    update: {
      status: 'CONNECTED',
      accessTokenCiphertext: encrypt(tokens.access_token),
      ...(tokens.refresh_token ? { refreshTokenCiphertext: encrypt(tokens.refresh_token) } : {}),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      accountName: profile.account.name,
      locationName: profile.location.name,
      lastError: null,
      metadata: { accountLabel: profile.account.accountName, locationLabel: profile.location.title, country: profile.location.storefrontAddress?.regionCode },
    },
  });
  return payload.hotelId;
}

async function validAccessToken(connection: { id: string; accessTokenCiphertext: string | null; refreshTokenCiphertext: string | null; tokenExpiresAt: Date | null }) {
  if (connection.accessTokenCiphertext && connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > Date.now() + 60_000) return decrypt(connection.accessTokenCiphertext)!;
  const refreshToken = decrypt(connection.refreshTokenCiphertext);
  if (!refreshToken) throw new Error('Google refresh token is missing. Reconnect the Business Profile account.');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.reviewIntegrations.google.clientId, client_secret: config.reviewIntegrations.google.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const tokens = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !tokens.access_token) throw new Error(tokens.error_description || 'Google access token refresh failed.');
  await prisma.reviewProviderConnection.update({ where: { id: connection.id }, data: { accessTokenCiphertext: encrypt(tokens.access_token), tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000) } });
  return tokens.access_token;
}

const ratingValue: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export async function syncGoogleReviews(hotelId: string) {
  const connection = await prisma.reviewProviderConnection.findUnique({ where: { hotelId_provider: { hotelId, provider: PROVIDER } } });
  if (!connection || connection.status !== 'CONNECTED' || !connection.accountName || !connection.locationName) throw new Error('Google Business Profile is not connected.');
  try {
    const accessToken = await validAccessToken(connection);
    const parent = `${connection.accountName}/${connection.locationName}`;
    const data = await googleJson<{ reviews?: Array<{ reviewId?: string; name?: string; starRating?: string; comment?: string; createTime?: string; updateTime?: string; reviewer?: { displayName?: string }; reviewReply?: { comment?: string; updateTime?: string } }> }>(`https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=50`, accessToken);
    const metadata = (connection.metadata || {}) as { country?: string };
    let imported = 0;
    for (const review of data.reviews || []) {
      const externalId = review.reviewId || review.name;
      if (!externalId) continue;
      await prisma.review.upsert({
        where: { hotelId_source_externalId: { hotelId, source: 'GOOGLE', externalId } },
        create: { hotelId, source: 'GOOGLE', externalId, rating: ratingValue[review.starRating || ''] || 0, comment: review.comment || null, response: review.reviewReply?.comment || null, respondedAt: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null, reviewerName: review.reviewer?.displayName || 'Google guest', reviewerCountry: metadata.country || null, createdAt: review.createTime ? new Date(review.createTime) : new Date(), providerMetadata: { providerName: review.name, updatedAt: review.updateTime } },
        update: { rating: ratingValue[review.starRating || ''] || 0, comment: review.comment || null, response: review.reviewReply?.comment || null, respondedAt: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null, reviewerName: review.reviewer?.displayName || 'Google guest', reviewerCountry: metadata.country || null, providerMetadata: { providerName: review.name, updatedAt: review.updateTime } },
      });
      imported += 1;
    }
    await prisma.reviewProviderConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date(), lastError: null } });
    return { imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google review sync failed.';
    await prisma.reviewProviderConnection.update({ where: { id: connection.id }, data: { status: 'ERROR', lastError: message } });
    throw error;
  }
}
