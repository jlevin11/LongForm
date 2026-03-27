'use client'

// E2E Encryption using Web Crypto API
// - RSA-OAEP (2048-bit) for key wrapping
// - AES-256-GCM for content encryption
// - PBKDF2 for password-based key derivation

const RSA_ALGO = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}

const AES_ALGO = { name: 'AES-GCM', length: 256 }

export function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

// Generate RSA keypair for a new user
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(RSA_ALGO, true, ['encrypt', 'decrypt'])
  const publicKeyBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const privateKeyBuf = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  return {
    publicKey: bufToB64(publicKeyBuf),
    privateKey: bufToB64(privateKeyBuf),
  }
}

// Derive a wrapping key from password + salt using PBKDF2
async function deriveWrappingKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    passwordKey,
    AES_ALGO,
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt private key with password (for storage)
export async function encryptPrivateKey(
  privateKeyB64: string,
  password: string
): Promise<{ encryptedPrivateKey: string; salt: string; iv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrappingKey = await deriveWrappingKey(password, salt.buffer as ArrayBuffer)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    b64ToBuf(privateKeyB64)
  )
  return {
    encryptedPrivateKey: bufToB64(encrypted),
    salt: bufToB64(salt.buffer as ArrayBuffer),
    iv: bufToB64(iv.buffer as ArrayBuffer),
  }
}

// Decrypt private key using password
export async function decryptPrivateKey(
  encryptedPrivateKeyB64: string,
  password: string,
  saltB64: string,
  ivB64: string
): Promise<string> {
  const wrappingKey = await deriveWrappingKey(password, b64ToBuf(saltB64))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(ivB64) },
    wrappingKey,
    b64ToBuf(encryptedPrivateKeyB64)
  )
  return bufToB64(decrypted)
}

// Encrypt content string for a given RSA public key
export async function encryptContent(
  content: string,
  publicKeyB64: string
): Promise<{ encryptedContent: string; iv: string; encryptedKey: string }> {
  const symKey = await crypto.subtle.generateKey(AES_ALGO, true, ['encrypt', 'decrypt'])
  const symKeyBuf = await crypto.subtle.exportKey('raw', symKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    symKey,
    new TextEncoder().encode(content)
  )
  const publicKey = await crypto.subtle.importKey(
    'spki',
    b64ToBuf(publicKeyB64),
    RSA_ALGO,
    false,
    ['encrypt']
  )
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, symKeyBuf)
  return {
    encryptedContent: bufToB64(encryptedContent),
    iv: bufToB64(iv.buffer as ArrayBuffer),
    encryptedKey: bufToB64(encryptedKey),
  }
}

// Re-wrap a symmetric key for a different public key (used when committing for counterparty)
export async function rewrapKeyForParty(
  encryptedKeyB64: string,
  myPrivateKeyB64: string,
  theirPublicKeyB64: string
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    b64ToBuf(myPrivateKeyB64),
    RSA_ALGO,
    false,
    ['decrypt']
  )
  const symKeyBuf = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    b64ToBuf(encryptedKeyB64)
  )
  const theirPublicKey = await crypto.subtle.importKey(
    'spki',
    b64ToBuf(theirPublicKeyB64),
    RSA_ALGO,
    false,
    ['encrypt']
  )
  const newEncryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    theirPublicKey,
    symKeyBuf
  )
  return bufToB64(newEncryptedKey)
}

// Decrypt content using private key
export async function decryptContent(
  encryptedContentB64: string,
  ivB64: string,
  encryptedKeyB64: string,
  privateKeyB64: string
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    b64ToBuf(privateKeyB64),
    RSA_ALGO,
    false,
    ['decrypt']
  )
  const symKeyBuf = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    b64ToBuf(encryptedKeyB64)
  )
  const symKey = await crypto.subtle.importKey('raw', symKeyBuf, AES_ALGO, false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(ivB64) },
    symKey,
    b64ToBuf(encryptedContentB64)
  )
  return new TextDecoder().decode(decrypted)
}

// Session key storage (lasts for browser tab session)
export function storePrivateKey(userId: string, privateKeyB64: string): void {
  sessionStorage.setItem(`cg_pk_${userId}`, privateKeyB64)
}

export function getStoredPrivateKey(userId: string): string | null {
  return sessionStorage.getItem(`cg_pk_${userId}`)
}

export function clearPrivateKey(userId: string): void {
  sessionStorage.removeItem(`cg_pk_${userId}`)
}
