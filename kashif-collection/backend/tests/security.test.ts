import request from 'supertest';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { app } from './helpers';
import { clientIp } from '../src/middleware/clientIp';

function run(headers: Record<string, string>, ip = '10.0.0.1') {
  const req = { headers, ip } as unknown as Request;
  clientIp(req, {} as Response, () => undefined);
  return req.clientIp;
}

describe('Security middleware', () => {
  it('trusts X-Client-IP only when the proxy secret matches', () => {
    expect(run({ 'x-client-ip': '203.0.113.9' })).toBe('10.0.0.1');
    expect(run({ 'x-client-ip': '203.0.113.9', 'x-proxy-secret': 'wrong' })).toBe('10.0.0.1');
    expect(run({ 'x-client-ip': '203.0.113.9, 1.2.3.4', 'x-proxy-secret': process.env.PROXY_SHARED_SECRET! })).toBe('203.0.113.9');
  });

  it('sends secure headers and never leaks stack traces for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Route GET /api/does-not-exist not found', errorCode: 'ROUTE_NOT_FOUND' });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('rejects malformed JSON with a consistent error', async () => {
    const res = await request(app).post('/api/auth/login').set('x-kc-client', 't').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_JSON');
  });

  it('only allows configured CORS origins', async () => {
    const ok = await request(app).options('/api/products').set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const evil = await request(app).options('/api/products').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
