const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function unbase64(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

export function randomUrlToken(bytes = 32): string {
  return base64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256Url(value: string): Promise<string> {
  return base64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function encryptionKey(): Promise<CryptoKey> {
  const encoded = process.env["GSC_TOKEN_KEY"];
  if (!encoded) throw new Error("Search Console token encryption is not configured");
  const raw = unbase64(encoded);
  if (raw.length !== 32) throw new Error("Search Console token key must be 32 bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(token));
  return { ciphertext: base64(new Uint8Array(encrypted)), iv: base64(iv) };
}

export async function decryptToken(ciphertext: string, iv: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(iv) }, await encryptionKey(), unbase64(ciphertext));
  return decoder.decode(decrypted);
}
