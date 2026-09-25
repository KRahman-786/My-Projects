import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../services/storage.service';
import { AppError } from '../utils/AppError';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** In-memory upload; the buffer is streamed to Cloudinary (never stored in PostgreSQL). Content is re-checked by magic bytes. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(AppError.badRequest('Only JPG, PNG, WEBP or GIF images are allowed', 'INVALID_IMAGE'));
  },
});
