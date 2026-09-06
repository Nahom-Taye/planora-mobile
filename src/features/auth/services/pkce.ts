export type PkceCrypto = {
  randomBytes: (count: number) => Promise<Uint8Array>;
  sha256Base64: (value: string) => Promise<string>;
};

export async function createPkce(crypto: PkceCrypto) {
  const bytes = await crypto.randomBytes(32);
  const verifier = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const challenge = (await crypto.sha256Base64(verifier)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (bytes.length !== 32 || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    throw new Error('Secure account cryptography unavailable.');
  }
  return { verifier, challenge, method: 's256' as const };
}
