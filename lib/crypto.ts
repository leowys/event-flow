import crypto from "crypto";

// Deriva una clave de 32 bytes a partir de AUTH_SECRET (no reutilizamos el
// secreto directamente como clave AES: lo pasamos por SHA-256 para obtener
// exactamente 32 bytes sin importar el largo del string original).
// Esto evita pedir una variable de entorno más solo para esto — si en algún
// momento se rota AUTH_SECRET, las API keys guardadas quedarían ilegibles,
// así que ese es un trade-off a tener en cuenta.
function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET no está definido; requerido también para encriptar credenciales.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

const ALGORITHM = "aes-256-gcm";

// Formato de salida: "<iv_base64>:<authTag_base64>:<ciphertext_base64>"
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, dataB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("Formato de credencial encriptada inválido.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}

// Para mostrar en la UI sin exponer la key completa, ej. "re_ab12...9xZ4"
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 8) return "••••••••";
  return `${plaintext.slice(0, 4)}${"•".repeat(6)}${plaintext.slice(-4)}`;
}
