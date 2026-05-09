
const PBKDF2_DEFAULT_ITERATIONS = 600_000;
const KEY_LENGTH_BITS = 256;

const requireSubtle = (): SubtleCrypto => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('CRYPTO_UNAVAILABLE: Web Crypto subtle is not available');
  }
  return crypto.subtle;
};

export const derivePbkdf2Key = async (
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_DEFAULT_ITERATIONS,
): Promise<CryptoKey> => {
  const subtle = requireSubtle();
  const passphraseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    passphraseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt'],
  );
};

export const exportRawKey = async (key: CryptoKey): Promise<Uint8Array> => {
  const subtle = requireSubtle();
  const raw = await subtle.exportKey('raw', key);
  return new Uint8Array(raw);
};

/**
 * 4-digit numeric PIN that gates the app on launch when
 * `SystemSettings.pinCodeEnabled` is true. The threat model is
 * "casual physical access by another person on a shared device" —
 * peace of mind, not defense against an attacker who has filesystem
 * access (they can just delete settings.json). The PIN is hashed with
 * a per-user salt so it never sits as plaintext in settings.json.
 */
export const PIN_LENGTH = 4;
export const PIN_SALT_BYTES = 16;

/**
 * PBKDF2 iteration count for PIN hashing. Lower than the sync-passphrase
 * count (600k) because the PIN is entered every app launch and the
 * attacker model is bounded — local filesystem access trivially
 * defeats any number of iterations. 100k keeps the unlock latency
 * snappy (~50–100ms on typical hardware) while still adding a
 * meaningful per-attempt cost.
 */
export const PIN_PBKDF2_ITERATIONS = 100_000;

const PIN_RE = /^[0-9]{4}$/;

const bytesToHex = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i]!.toString(16).padStart(2, '0');
  return s;
};

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const constantTimeStringEq = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const isValidPin = (pin: string): boolean => PIN_RE.test(pin);

export const generatePinSalt = (): string =>
  bytesToHex(crypto.getRandomValues(new Uint8Array(PIN_SALT_BYTES)));

export const hashPin = async (pin: string, saltHex: string): Promise<string> => {
  const key = await derivePbkdf2Key(pin, hexToBytes(saltHex), PIN_PBKDF2_ITERATIONS);
  return bytesToHex(await exportRawKey(key));
};

export const verifyPin = async (
  pin: string,
  saltHex: string,
  storedHashHex: string,
): Promise<boolean> => {
  const computed = await hashPin(pin, saltHex);
  return constantTimeStringEq(computed, storedHashHex);
};
