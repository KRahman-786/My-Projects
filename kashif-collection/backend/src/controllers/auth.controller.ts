import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { clearSessionCookie, setSessionCookie } from '../services/token.service';
import { currentUser } from '../middleware/auth';
import { created, ok } from '../utils/response';

export async function register(req: Request, res: Response) {
  const { user, token } = await authService.register(req.body);
  setSessionCookie(res, token);
  created(res, { user }, 'Welcome to Kashif Collection!');
}

export async function login(req: Request, res: Response) {
  const { user, token } = await authService.login(req.body);
  setSessionCookie(res, token);
  ok(res, { user }, { message: 'Logged in successfully' });
}

export async function logout(_req: Request, res: Response) {
  clearSessionCookie(res);
  ok(res, null, { message: 'Logged out' });
}

export async function logoutAll(req: Request, res: Response) {
  await authService.logoutAllDevices(currentUser(req).id);
  clearSessionCookie(res);
  ok(res, null, { message: 'Logged out from all devices' });
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.requestPasswordReset(req.body.email);
  ok(res, null, { message: 'If an account exists for this email, a password reset link has been sent.' });
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body.token, req.body.password);
  clearSessionCookie(res);
  ok(res, null, { message: 'Password updated. Please log in with your new password.' });
}

export async function session(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  ok(res, { user: req.user ? await authService.getProfile(req.user.id) : null });
}

export async function me(req: Request, res: Response) {
  ok(res, { user: await authService.getProfile(currentUser(req).id) });
}

export async function updateMe(req: Request, res: Response) {
  ok(res, { user: await authService.updateProfile(currentUser(req).id, req.body) }, { message: 'Profile updated' });
}

export async function changePassword(req: Request, res: Response) {
  const token = await authService.changePassword(currentUser(req).id, req.body.currentPassword, req.body.newPassword);
  setSessionCookie(res, token);
  ok(res, null, { message: 'Password changed successfully' });
}
