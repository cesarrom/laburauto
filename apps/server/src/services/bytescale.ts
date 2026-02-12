import { UploadManager } from '@bytescale/sdk';
import crypto from 'crypto';
import 'multer'; // Ensure Express.Multer types are augmented

// Account ID, HMAC Key, and API Key ID will be read from process.env inside functions
// to allow for easier testing and runtime configuration.

const isTest = process.env.NODE_ENV === 'test';

// In test environment, don't instantiate the real SDK to avoid throwing on missing keys
const uploadManager = isTest ? {
  upload: async ({ path }: any) => ({ fileUrl: `https://mock-url.com${path}`, filePath: path })
} as any : new UploadManager({
  apiKey: process.env.BYTESCALE_API_KEY || '',
});

export async function uploadBuffer(buffer: Buffer, mimetype: string, originalname: string, folder: string = 'uploads'): Promise<string> {
  try {
    const { fileUrl, filePath } = await uploadManager.upload({
      data: buffer,
      mime: mimetype,
      originalFileName: originalname,
      path: `/${folder}/${Date.now()}_${originalname}`,
    });

    return filePath;
  } catch (error) {
    console.error('Bytescale upload error:', error);
    throw new Error('Failed to upload file');
  }
}

export async function uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
  return uploadBuffer(file.buffer, file.mimetype, file.originalname, folder);
}

export function getSignedUrl(filePath: string, expiresInSeconds: number = 600): string {
  // Use the new variables provided by the user
  const API_KEY_ID = process.env.BYTESCALE_API_KEY_ID;
  const API_KEY_HMAC = process.env.BYTESCALE_API_KEY_HMAC;
  const ACCOUNT_ID = process.env.BYTESCALE_ACCOUNT_ID || '223k2XC'; // Fallback to existing default if not set

  if (!API_KEY_ID || !API_KEY_HMAC) {
    console.warn("Bytescale keys missing for signing. Returning raw URL.");
    // Ensure filePath starts with /
    const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `https://upcdn.io/${ACCOUNT_ID}/raw${path}`;
  }

  // Ensure filePath starts with /
  const path = filePath.startsWith('/') ? filePath : `/${filePath}`;

  // 1. Calculate expiration (Rounded to 60s for cache hit rate)
  const ttlIncrement = 60;
  const now = Math.floor(Date.now() / 1000);
  const expiration = Math.ceil((now + expiresInSeconds) / ttlIncrement) * ttlIncrement;

  // 2. Construct the Base URL
  // Standard raw path: https://upcdn.io/{accountId}/raw{path}
  const urlBase = `https://upcdn.io/${ACCOUNT_ID}/raw${path}`;

  // 3. Construct URL with Params
  const delimiter = urlBase.includes('?') ? '&' : '?';
  const urlWithExp = `${urlBase}${delimiter}exp=${expiration}`;

  // 4. Prepare String to Sign (Schemeless)
  // "signature is calculated over the full URL, excluding the URL scheme"
  const schemelessUrl = urlWithExp.replace(/^https?:\/\//, '');

  // 5. Create HMAC-SHA256 signature
  // Key must be decoded from Base64
  const keyBuffer = Buffer.from(API_KEY_HMAC, 'base64');

  const signature = crypto.createHmac('sha256', keyBuffer)
    .update(schemelessUrl)
    .digest('base64url'); // Node.js 'base64url' encoding

  // 6. Construct 'sig' parameter
  // Format: sig=1.{apiKeyId}.{signature}
  const sigParam = `sig=1.${API_KEY_ID}.${signature}`;

  // 7. Final URL
  return `${urlWithExp}&${sigParam}`;
}

export async function uploadMultipleFiles(files: Express.Multer.File[], folder: string = 'uploads'): Promise<string[]> {
  try {
    const uploadPromises = files.map(file => uploadFile(file, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Bytescale multiple upload error:', error);
    throw new Error('Failed to upload files');
  }
}
