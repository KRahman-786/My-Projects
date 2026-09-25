import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { randomToken, sha256 } from '../utils/crypto';
import { signSessionToken } from './token.service';
import { sendMail } from './mailer.service';
import type { LoginInput, RegisterInput, UpdateProfileInput } from '../validators/auth.validators';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MINUTES = 30;
// Pre-computed hash used to keep login timing uniform when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_ROUNDS);

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('An account with this email already exists', 'EMAIL_IN_USE');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      cart: { create: {} },
      wishlist: { create: {} },
    },
    select: { ...publicUserSelect, tokenVersion: true },
  });
  const { tokenVersion, ...publicUser } = user;
  return { user: publicUser, token: signSessionToken(user.id, tokenVersion) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (!user.isActive || user.deletedAt) throw AppError.forbidden('This account has been deactivated. Please contact support.', 'ACCOUNT_DISABLED');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return {
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, createdAt: user.createdAt },
    token: signSessionToken(user.id, user.tokenVersion),
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  return prisma.user.update({ where: { id: userId }, data: input, select: publicUserSelect });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw AppError.badRequest('Current password is incorrect', 'INVALID_PASSWORD');
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });
  // Returns a fresh token so the current device stays logged in while other sessions are revoked.
  return signSessionToken(updated.id, updated.tokenVersion);
}

/** Always resolves (no user enumeration). Sends a reset link when the account exists. */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || user.deletedAt) return;

  const token = randomToken(32);
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000) },
    }),
  ]);
  const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your Kashif Collection password',
    text: `Hi ${user.name},\n\nUse the link below to reset your password. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes.\n\n${link}\n\nIf you did not request this, you can ignore this email.\n\n— Kashif Collection`,
  });
}

export async function resetPassword(token: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest('This reset link is invalid or has expired', 'INVALID_RESET_TOKEN');
  }
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } },
    }),
  ]);
}

export async function logoutAllDevices(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}
