import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, createUser, customerAgent, loginAgent, prisma, resetDb } from './helpers';
import { sentMail } from '../src/services/mailer.service';

const H = { 'x-kc-client': 'test' };

describe('Authentication', () => {
  beforeEach(resetDb);

  it('registers a user, hashes the password and sets an HTTP-only session cookie', async () => {
    const res = await request(app).post('/api/auth/register').set(H).send({ name: 'Zara Ali', email: 'Zara@Example.com', password: 'Secret123' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('zara@example.com');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/kc_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'zara@example.com' } });
    expect(user.passwordHash).not.toContain('Secret123');
    expect(user.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects duplicate emails and weak passwords with consistent error shape', async () => {
    await createUser({ email: 'dupe@example.com' });
    const dupe = await request(app).post('/api/auth/register').set(H).send({ name: 'Dupe', email: 'dupe@example.com', password: 'Secret123' });
    expect(dupe.status).toBe(409);
    expect(dupe.body).toMatchObject({ success: false, errorCode: 'EMAIL_IN_USE' });

    const weak = await request(app).post('/api/auth/register').set(H).send({ name: 'Weak', email: 'weak@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.errorCode).toBe('VALIDATION_ERROR');
    expect(weak.body.stack).toBeUndefined();
  });

  it('logs in, returns the profile via /api/me and logs out', async () => {
    const { user, password } = await createUser();
    const agent = await loginAgent(user.email, password);
    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(user.email);

    await agent.post('/api/auth/logout');
    const after = await agent.get('/api/me');
    expect(after.status).toBe(401);
  });

  it('rejects invalid credentials and deactivated accounts', async () => {
    const { user } = await createUser();
    const bad = await request(app).post('/api/auth/login').set(H).send({ email: user.email, password: 'WrongPass1' });
    expect(bad.status).toBe(401);
    expect(bad.body.errorCode).toBe('INVALID_CREDENTIALS');

    const unknown = await request(app).post('/api/auth/login').set(H).send({ email: 'nobody@example.com', password: 'WrongPass1' });
    expect(unknown.body.errorCode).toBe('INVALID_CREDENTIALS');

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const disabled = await request(app).post('/api/auth/login').set(H).send({ email: user.email, password: 'Password123' });
    expect(disabled.status).toBe(403);
  });

  it('changing the password revokes other sessions', async () => {
    const { user, password } = await createUser();
    const deviceA = await loginAgent(user.email, password);
    const deviceB = await loginAgent(user.email, password);
    const change = await deviceA.post('/api/me/change-password').send({ currentPassword: password, newPassword: 'NewSecret99' });
    expect(change.status).toBe(200);
    expect((await deviceA.get('/api/me')).status).toBe(200);
    expect((await deviceB.get('/api/me')).status).toBe(401);
  });

  it('supports forgot/reset password with single-use tokens and no user enumeration', async () => {
    const { user } = await createUser();
    sentMail.length = 0;
    const res = await request(app).post('/api/auth/forgot-password').set(H).send({ email: user.email });
    expect(res.status).toBe(200);
    const unknown = await request(app).post('/api/auth/forgot-password').set(H).send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(res.body.message);
    expect(sentMail).toHaveLength(1);

    const token = /token=([a-f0-9]+)/.exec(sentMail[0]!.text)![1]!;
    const reset = await request(app).post('/api/auth/reset-password').set(H).send({ token, password: 'BrandNew123' });
    expect(reset.status).toBe(200);
    const reuse = await request(app).post('/api/auth/reset-password').set(H).send({ token, password: 'Another123' });
    expect(reuse.body.errorCode).toBe('INVALID_RESET_TOKEN');
    await loginAgent(user.email, 'BrandNew123');
  });

  it('requires the CSRF client header for cookie-authenticated writes', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('CSRF_CHECK_FAILED');
  });
});

describe('Admin authorization', () => {
  beforeEach(resetDb);

  it('blocks anonymous and customer access to admin APIs', async () => {
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    const { agent } = await customerAgent();
    const res = await agent.get('/api/admin/dashboard');
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
    expect((await agent.post('/api/admin/products').send({})).status).toBe(403);
  });

  it('never exposes password hashes in admin customer views', async () => {
    const { user, password } = await createUser({ role: 'ADMIN' });
    await createUser();
    const admin = await loginAgent(user.email, password);
    const res = await admin.get('/api/admin/customers');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion/);
  });
});
