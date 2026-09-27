import { argon2idAsync } from '@noble/hashes/argon2.js';
import * as Crypto from 'expo-crypto';

const ARGON2_OPTIONS = {
  dkLen: 32,
  m: 19_456,
  t: 2,
  p: 1,
  maxmem: 32 * 1024 * 1024,
  asyncTick: 10,
} as const;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array | null {
  if (!/^(?:[a-f\d]{2})+$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = Crypto.getRandomBytes(16);
  const derivedKey = await argon2idAsync(password, salt, ARGON2_OPTIONS);
  return `argon2id$v=19$m=${ARGON2_OPTIONS.m},t=${ARGON2_OPTIONS.t},p=${ARGON2_OPTIONS.p}$${toHex(salt)}$${toHex(derivedKey)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 5 || parts[0] !== 'argon2id' || parts[1] !== 'v=19') return false;

  const parameters = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(parts[2]);
  const salt = fromHex(parts[3]);
  const expected = fromHex(parts[4]);
  if (!parameters || !salt || !expected || salt.length < 16 || expected.length !== ARGON2_OPTIONS.dkLen) {
    return false;
  }

  const [, memory, iterations, parallelism] = parameters;
  const m = Number(memory);
  const t = Number(iterations);
  const p = Number(parallelism);
  if (m < 19_456 || m > 65_536 || t < 2 || t > 6 || p !== 1) return false;

  const actual = await argon2idAsync(password, salt, {
    dkLen: expected.length,
    m,
    t,
    p,
    maxmem: m * 1024 + 1024 * 1024,
    asyncTick: 10,
  });

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}