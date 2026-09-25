import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env, features, isProd } from '../config/env';
import { AppError } from '../utils/AppError';
import { randomToken } from '../utils/crypto';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

if (features.cloudinary) {
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
}

/** Detects the real image type from magic bytes (the client-supplied mimetype is not trusted). */
export function sniffImageType(buf: Buffer): 'jpg' | 'png' | 'webp' | 'gif' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a') return 'gif';
  return null;
}

export interface StoredImage {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
}

/**
 * Uploads to Cloudinary (auto format + quality, max 1600px) when CLOUDINARY_* is configured.
 * In development without Cloudinary, files are written to ./uploads and served by the API.
 */
export async function uploadImage(buffer: Buffer, folder: 'products' | 'reviews' | 'categories'): Promise<StoredImage> {
  const type = sniffImageType(buffer);
  if (!type) throw AppError.badRequest('Only JPG, PNG, WEBP or GIF images are allowed', 'INVALID_IMAGE');

  if (features.cloudinary) {
    const result = await new Promise<{ secure_url: string; public_id: string; width: number; height: number }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `${env.CLOUDINARY_FOLDER}/${folder}`,
            resource_type: 'image',
            transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
          },
          (error, res) => (error || !res ? reject(error ?? new Error('Upload failed')) : resolve(res)),
        )
        .end(buffer);
    });
    // f_auto,q_auto delivers WebP/AVIF at an optimal quality to each browser.
    const url = result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    return { url, publicId: result.public_id, width: result.width, height: result.height };
  }

  if (isProd) {
    throw AppError.serviceUnavailable('Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.', 'STORAGE_NOT_CONFIGURED');
  }
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomToken(6)}.${type}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return { url: `${env.API_PUBLIC_URL}/uploads/${folder}/${filename}`, publicId: `local:${folder}/${filename}` };
}

export async function deleteImage(publicId: string | null | undefined) {
  if (!publicId) return;
  if (publicId.startsWith('local:')) {
    const rel = publicId.slice('local:'.length);
    const target = path.resolve(UPLOAD_DIR, rel);
    if (target.startsWith(UPLOAD_DIR)) await fs.rm(target, { force: true });
    return;
  }
  if (features.cloudinary) await cloudinary.uploader.destroy(publicId).catch(() => undefined);
}
