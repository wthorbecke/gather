/**
 * Token Encryption using AES-256-GCM
 *
 * Encrypts sensitive tokens (OAuth tokens, API keys) before storing in database.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Environment variable required:
 * - TOKEN_ENCRYPTION_KEY: 64-character hex string (32 bytes = 256 bits)
 *
 * Generate a key: openssl rand -hex 32
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM recommended IV length
const AUTH_TAG_LENGTH = 16 // 128-bit auth tag
const KEY_LENGTH = 32 // 256 bits

// ============================================================================
// Key Management
// ============================================================================

let encryptionKey: Buffer | null = null

/**
 * Get the encryption key from environment variable.
 * Lazily initialized and cached.
 */
function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey

  const keyHex = process.env.TOKEN_ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error(
      '[Encryption] TOKEN_ENCRYPTION_KEY not configured. ' +
      'Generate one with: openssl rand -hex 32'
    )
  }

  if (keyHex.length !== 64) {
    throw new Error(
      `[Encryption] TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyHex.length}`
    )
  }

  // Validate hex string
  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error('[Encryption] TOKEN_ENCRYPTION_KEY must be a valid hex string')
  }

  encryptionKey = Buffer.from(keyHex, 'hex')

  if (encryptionKey.length !== KEY_LENGTH) {
    throw new Error(`[Encryption] Decoded key must be ${KEY_LENGTH} bytes`)
  }

  return encryptionKey
}

/**
 * Check if encryption is configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Output format: base64(iv + authTag + ciphertext)
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted data
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()

  // Generate random IV
  const iv = randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv)

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  // Get auth tag
  const authTag = cipher.getAuthTag()

  // Combine: IV + AuthTag + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted])

  return combined.toString('base64')
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 *
 * @param encryptedData - Base64-encoded encrypted data
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (invalid data or tampered)
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey()

  // Decode from base64
  const combined = Buffer.from(encryptedData, 'base64')

  // Validate minimum length
  const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1
  if (combined.length < minLength) {
    throw new Error('[Encryption] Invalid encrypted data: too short')
  }

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  // Decrypt
  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch (error) {
    // This could be tampering, wrong key, or corrupted data
    throw new Error('[Encryption] Decryption failed: data may be tampered or corrupted')
  }
}

// ============================================================================
// Token-Specific Helpers
// ============================================================================

/**
 * Encrypt OAuth tokens for storage.
 * Returns original value if encryption is not configured (development).
 */
export function encryptToken(token: string): string {
  if (!isEncryptionConfigured()) {
    // In development without encryption, store as-is with a prefix
    // so we know it's not encrypted
    return `PLAIN:${token}`
  }

  return encrypt(token)
}

/**
 * Decrypt OAuth tokens from storage.
 * Handles both encrypted and plain tokens (for migration).
 */
export function decryptToken(storedValue: string): string {
  // Handle plain tokens (development or pre-encryption data)
  if (storedValue.startsWith('PLAIN:')) {
    return storedValue.slice(6)
  }

  // Handle legacy unencrypted tokens (doesn't start with expected base64)
  // OAuth tokens typically start with "ya29." for Google
  if (storedValue.startsWith('ya29.') || storedValue.startsWith('1//')) {
    return storedValue
  }

  // Try to decrypt
  try {
    return decrypt(storedValue)
  } catch (error) {
    // If decryption fails, assume it's an unencrypted legacy token
    console.warn('[Encryption] Decryption failed, assuming legacy unencrypted token')
    return storedValue
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a new encryption key.
 * Useful for initial setup or key rotation.
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Rotate encryption - re-encrypt data with a new key.
 * Use this when rotating TOKEN_ENCRYPTION_KEY.
 *
 * @param encryptedData - Data encrypted with old key
 * @param oldKeyHex - Old encryption key (hex)
 * @param newKeyHex - New encryption key (hex)
 * @returns Data encrypted with new key
 */
export function rotateEncryption(
  encryptedData: string,
  oldKeyHex: string,
  newKeyHex: string
): string {
  // Temporarily decrypt with old key
  const oldKey = Buffer.from(oldKeyHex, 'hex')
  const combined = Buffer.from(encryptedData, 'base64')

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, oldKey, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')

  // Re-encrypt with new key
  const newKey = Buffer.from(newKeyHex, 'hex')
  const newIv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, newKey, newIv)

  const encrypted = Buffer.concat([
    cipher.update(decrypted, 'utf8'),
    cipher.final(),
  ])

  const newAuthTag = cipher.getAuthTag()
  const newCombined = Buffer.concat([newIv, newAuthTag, encrypted])

  return newCombined.toString('base64')
}
