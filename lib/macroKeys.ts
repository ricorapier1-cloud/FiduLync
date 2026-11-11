import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function getEncryptionKey() {
  const secret = process.env.MT5_KEY_ENCRYPTION_SECRET?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error('MT5 license-key encryption is not configured.');
  return createHash('sha256').update(secret).digest();
}

export function generateMacroApiKey() {
  return `ml_${randomBytes(32).toString('hex')}`;
}

export function encryptMacroApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptMacroApiKey(encryptedKey: string) {
  const [encodedIv, encodedTag, encodedCiphertext, ...unexpected] = encryptedKey.split('.');
  if (!encodedIv || !encodedTag || !encodedCiphertext || unexpected.length) {
    throw new Error('Stored MT5 license key has an invalid encrypted format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
