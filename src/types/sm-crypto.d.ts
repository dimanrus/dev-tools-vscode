declare module 'sm-crypto' {
  export interface Sm2KeyPair {
    publicKey: string;
    privateKey: string;
  }

  export const sm2: {
    generateKeyPairHex(): Sm2KeyPair;
    getPublicKeyFromPrivateKey(privateKey: string): string;
    compressPublicKeyHex(publicKey: string): string;
    verifyPublicKey(publicKey: string): boolean;
    doEncrypt(message: string | number[], publicKey: string, cipherMode?: number): string;
    doDecrypt(ciphertext: string, privateKey: string, cipherMode?: number): string;
    doSignature(message: string, privateKey: string, options?: { der?: boolean; pointPool?: unknown }): string;
    doVerifySignature(message: string, signature: string, publicKey: string, options?: { der?: boolean }): boolean;
  };

  export function sm3(message: string | number[]): string;

  export const sm4: {
    encrypt(message: string | number[], key: string, options?: Record<string, unknown>): string | number[];
    decrypt(ciphertext: string | number[], key: string, options?: Record<string, unknown>): string | number[];
  };

  const sm: { sm2: typeof sm2; sm3: typeof sm3; sm4: typeof sm4 };
  export default sm;
}
