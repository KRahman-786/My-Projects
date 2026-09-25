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
      /** Raw request body, captured only for webhook routes (signature verification). */
      rawBody?: Buffer;
    }
  }
}

export {};
