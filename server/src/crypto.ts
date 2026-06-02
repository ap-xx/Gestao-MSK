/**
 * AES-256-GCM symmetric encryption for storing e-Proc passwords.
 * We need to be able to DECRYPT the password to use it for login,
 * so bcrypt is not suitable here — we use reversible encryption instead.
 * The key is derived from JWT_SECRET so it's tied to the server instance.
 */
import crypto from 'crypto';

const ALGO      = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES  = 16;

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? 'msk-fallback-key-change-in-prod';
  return crypto.scryptSync(secret, 'msk-eproc-salt-v1', KEY_BYTES);
}

export function encrypt(plaintext: string): string {
  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, tagHex, encHex] = parts;
  const iv      = Buffer.from(ivHex,  'hex');
  const tag     = Buffer.from(tagHex, 'hex');
  const enc     = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
