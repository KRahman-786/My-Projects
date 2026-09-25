import { Router } from 'express';
import * as c from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { authLimiter, sensitiveLimiter } from '../middleware/rateLimit';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validators';

export const authRouter = Router();
authRouter.post('/register', authLimiter, validateBody(registerSchema), c.register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), c.login);
authRouter.post('/logout', c.logout);
/** Always 200: { user } for signed-in visitors, { user: null } for guests. */
authRouter.get('/session', optionalAuth, c.session);
authRouter.post('/logout-all', requireAuth, c.logoutAll);
authRouter.post('/forgot-password', sensitiveLimiter, validateBody(forgotPasswordSchema), c.forgotPassword);
authRouter.post('/reset-password', sensitiveLimiter, validateBody(resetPasswordSchema), c.resetPassword);

export const meRouter = Router();
meRouter.use(requireAuth);
meRouter.get('/', c.me);
meRouter.patch('/', validateBody(updateProfileSchema), c.updateMe);
meRouter.post('/change-password', authLimiter, validateBody(changePasswordSchema), c.changePassword);
