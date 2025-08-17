/**
 * Secure Encryption Service
 * Uses AES-256-GCM with PBKDF2 key derivation and salt for maximum security
 */

interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  tag: string;
}

class EncryptionService {
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;
  private readonly saltLength = 16;
  private readonly ivLength = 12;
  private readonly iterations = 100000; // PBKDF2 iterations

  /**
   * Get the master encryption key from environment variables
   */
  private getMasterKey(): string {
    const masterKey = Deno.env.get('ENCRYPTION_MASTER_KEY');
    if (!masterKey) {
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
    }
    if (masterKey.length < 32) {
      throw new Error('ENCRYPTION_MASTER_KEY must be at least 32 characters long');
    }
    return masterKey;
  }

  /**
   * Generate a random salt
   */
  private generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.saltLength));
  }

  /**
   * Generate a random IV (Initialization Vector)
   */
  private generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.ivLength));
  }

  /**
   * Derive encryption key from master key and salt using PBKDF2
   */
  private async deriveKey(salt: Uint8Array): Promise<CryptoKey> {
    const masterKey = this.getMasterKey();
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterKey),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty data');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Generate random salt and IV
    const salt = this.generateSalt();
    const iv = this.generateIV();
    
    // Derive encryption key
    const key = await this.deriveKey(salt);
    
    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      { name: this.algorithm, iv: iv },
      key,
      data
    );

    // Convert to base64 for storage
    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      salt: this.uint8ArrayToBase64(salt),
      iv: this.uint8ArrayToBase64(iv),
      tag: '' // GCM mode includes authentication tag in encrypted data
    };
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (!encryptedData.encrypted || !encryptedData.salt || !encryptedData.iv) {
      throw new Error('Invalid encrypted data format');
    }

    try {
      // Convert from base64
      const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
      const salt = this.base64ToUint8Array(encryptedData.salt);
      const iv = this.base64ToUint8Array(encryptedData.iv);
      
      // Derive the same encryption key
      const key = await this.deriveKey(salt);
      
      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv: iv },
        key,
        encrypted
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Utility: Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  }

  /**
   * Utility: Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Utility: Convert Uint8Array to base64
   */
  private uint8ArrayToBase64(array: Uint8Array): string {
    const binaryString = Array.from(array, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  }

  /**
   * Utility: Convert base64 to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Generate a secure random encryption key for environment variable
   */
  static generateMasterKey(): string {
    const array = crypto.getRandomValues(new Uint8Array(64));
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate that encryption is working correctly
   */
  async testEncryption(): Promise<boolean> {
    try {
      const testData = 'test-encryption-' + Date.now();
      const encrypted = await this.encrypt(testData);
      const decrypted = await this.decrypt(encrypted);
      return testData === decrypted;
    } catch (error) {
      console.error('Encryption test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Export types
export type { EncryptedData };

// Export class for testing
export { EncryptionService };