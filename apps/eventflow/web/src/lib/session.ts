export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  expiresAt: number;
}

export const SESSION_COOKIE_NAME = "eventflow_session";
const AUTH_SECRET = process.env.AUTH_SECRET || "eventflow_cfm_secret_key_2026";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const enc = new TextEncoder();
  const jsonStr = JSON.stringify(payload);
  const dataB64 = base64UrlEncode(enc.encode(jsonStr));
  const key = await getHmacKey();
  const signatureBytes = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sigB64 = base64UrlEncode(new Uint8Array(signatureBytes));
  return `${dataB64}.${sigB64}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [dataB64, sigB64] = parts;
    if (!dataB64 || !sigB64) return null;

    const enc = new TextEncoder();
    const key = await getHmacKey();
    const sigBytes = base64UrlDecode(sigB64);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      enc.encode(dataB64)
    );

    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(dataB64));
    const payload: SessionPayload = JSON.parse(payloadJson);

    if (Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}
