import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      name: string;
      role: Role;
    }
    interface Request {
      user?: AuthUser;
      /** Real visitor IP (see middleware/clientIp) */
      clientIp?: string;
      /** Raw request body, captured only for webhook routes (signature verification). */
      rawBody?: Buffer;
    }
  }
}

export {};
