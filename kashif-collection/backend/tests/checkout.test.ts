import { beforeEach, describe, expect, it } from 'vitest';
import { createProduct, customerAgent, inventoryOf, prisma, resetDb } from './helpers';
import { expireStaleOrders } from '../src/services/order.service';
import { updateSettings } from '../src/services/settings.service';

async function cartWith(variantId: string, quantity = 1) {
  const c = await customerAgent();
  const res = await c.agent.post('/api/cart/items').send({ variantId, quantity });
  expect(res.status).toBe(201);
  return c;
}

describe('Checkout & order creation', () => {
  beforeEach(resetDb);

  it('creates a COD order: CONFIRMED, payment PENDING, stock deducted, cart cleared', async () => {
    const p = await createProduct({ price: 40000, mrp: 50000, stocks: [10] });
    const v = p.variants[0]!;
    const { agent, addressId } = await cartWith(v.id, 2);

    const res = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD', idempotencyKey: 'checkout-1' });
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.orderNumber).toMatch(/^KC-\d{4}-\d{6}$/);
    expect(order.status).toBe('CONFIRMED');
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.paymentMethod).toBe('COD');
    expect(order.subtotal).toBe(80000);
    expect(order.codFee).toBe(4900);
    expect(order.grandTotal).toBe(80000 + 7900 + 4900);
    expect(order.cgst + order.sgst).toBe(order.taxTotal); // Uttar Pradesh → intra-state
    expect(order).not.toHaveProperty('idempotencyKey');

    const inv = await inventoryOf(v.id);
    expect(inv).toMatchObject({ totalStock: 8, reservedStock: 0, availableStock: 8 });
    expect((await agent.get('/api/cart')).body.data.lines).toHaveLength(0);

    const tx = await prisma.inventoryTransaction.findMany({ where: { inventoryId: inv.id }, orderBy: { createdAt: 'asc' } });
    expect(tx.map((t) => t.type)).toEqual(['RESERVE', 'SALE']);
  });

  it('generates sequential order numbers', async () => {
    const p = await createProduct({ stocks: [10] });
    const a = await cartWith(p.variants[0]!.id);
    const b = await cartWith(p.variants[0]!.id);
    const o1 = (await a.agent.post('/api/orders').send({ addressId: a.addressId, paymentMethod: 'COD' })).body.data.orderNumber as string;
    const o2 = (await b.agent.post('/api/orders').send({ addressId: b.addressId, paymentMethod: 'COD' })).body.data.orderNumber as string;
    expect(Number(o2.slice(-6))).toBe(Number(o1.slice(-6)) + 1);
  });

  it('is idempotent for retried submissions with the same key', async () => {
    const p = await createProduct({ stocks: [10] });
    const { agent, addressId } = await cartWith(p.variants[0]!.id);
    const first = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD', idempotencyKey: 'same-key-123' });
    const again = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD', idempotencyKey: 'same-key-123' });
    expect(again.status).toBe(200);
    expect(again.body.data.orderNumber).toBe(first.body.data.orderNumber);
    expect(await prisma.order.count()).toBe(1);
  });

  it('refuses the order when the price changed before checkout (PRICE_CHANGED)', async () => {
    const p = await createProduct({ price: 40000, mrp: 50000 });
    const { agent, addressId } = await cartWith(p.variants[0]!.id);
    const seen = (await agent.get('/api/cart?paymentMethod=COD')).body.data.summary.grandTotal;
    await prisma.product.update({ where: { id: p.id }, data: { price: 45000 } });

    const res = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD', expectedTotal: seen });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('PRICE_CHANGED');
    expect(res.body.details.currentTotal).toBe(seen + 5000);
    expect(await prisma.order.count()).toBe(0);
  });

  it('refuses when the product goes out of stock or inactive during checkout', async () => {
    const p = await createProduct({ stocks: [2] });
    const { agent, addressId } = await cartWith(p.variants[0]!.id, 2);
    await prisma.inventory.update({ where: { variantId: p.variants[0]!.id }, data: { totalStock: 1, availableStock: 1 } });
    const res = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD' });
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('INSUFFICIENT_STOCK');

    await prisma.product.update({ where: { id: p.id }, data: { isActive: false } });
    const res2 = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD' });
    expect(res2.body.errorCode).toBe('PRODUCT_UNAVAILABLE');
  });

  it('refuses when the coupon expires during checkout', async () => {
    await prisma.coupon.create({ data: { code: 'SHORT', type: 'PERCENTAGE', value: 10 } });
    const p = await createProduct({ price: 40000 });
    const { agent, addressId } = await cartWith(p.variants[0]!.id);
    expect((await agent.post('/api/cart/coupon').send({ code: 'SHORT' })).status).toBe(200);
    await prisma.coupon.update({ where: { code: 'SHORT' }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD' });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('COUPON_EXPIRED');
    expect(await prisma.order.count()).toBe(0);
    expect((await inventoryOf(p.variants[0]!.id)).reservedStock).toBe(0);
  });

  it('records coupon usage and releases it when the order is cancelled', async () => {
    const c = await prisma.coupon.create({ data: { code: 'ONCE', type: 'FIXED', value: 5000, perUserLimit: 1, usageLimit: 10 } });
    const p = await createProduct({ price: 40000, stocks: [5] });
    const { agent, addressId } = await cartWith(p.variants[0]!.id);
    const order = (await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD', couponCode: 'ONCE' })).body.data;
    expect(order.couponDiscount).toBe(5000);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount).toBe(1);

    const cancel = await agent.post(`/api/orders/${order.orderNumber}/cancel`).send({ reason: 'Changed my mind' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount).toBe(0);
    expect(await inventoryOf(p.variants[0]!.id)).toMatchObject({ totalStock: 5, availableStock: 5, reservedStock: 0 });
  });

  it('rejects unserviceable pincodes and COD outside configured limits', async () => {
    const p = await createProduct({ price: 40000 });
    const { agent, addressId, user } = await cartWith(p.variants[0]!.id);
    await prisma.serviceablePincode.create({ data: { pincode: '242001', isServiceable: false } });
    const blocked = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD' });
    expect(blocked.body.errorCode).toBe('PINCODE_NOT_SERVICEABLE');
    await prisma.serviceablePincode.deleteMany();

    await updateSettings({ codMaxOrderValue: 10000 });
    const tooBig = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD' });
    expect(tooBig.status).toBe(422);
    expect(tooBig.body.errorCode).toBe('COD_UNAVAILABLE');

    await updateSettings({ codEnabled: false, codMaxOrderValue: 1000000 });
    const disabled = await agent.post('/api/orders').send({ addressId, paymentMethod: 'COD' });
    expect(disabled.body.errorCode).toBe('COD_UNAVAILABLE');
    expect(await prisma.order.count({ where: { userId: user.id } })).toBe(0);
  });

  it('prevents overselling when two customers buy the last unit simultaneously', async () => {
    const p = await createProduct({ stocks: [1] });
    const v = p.variants[0]!;
    const a = await cartWith(v.id);
    const b = await cartWith(v.id);

    const results = await Promise.all([
      a.agent.post('/api/orders').send({ addressId: a.addressId, paymentMethod: 'COD' }),
      b.agent.post('/api/orders').send({ addressId: b.addressId, paymentMethod: 'COD' }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const loser = results.find((r) => r.status === 409)!;
    expect(['OUT_OF_STOCK', 'INSUFFICIENT_STOCK']).toContain(loser.body.errorCode);
    expect(await inventoryOf(v.id)).toMatchObject({ totalStock: 0, availableStock: 0, reservedStock: 0 });
    expect(await prisma.order.count()).toBe(1);
  });

  it('holds stock for unpaid online orders and releases it when the reservation expires', async () => {
    const p = await createProduct({ stocks: [3] });
    const v = p.variants[0]!;
    const { agent, addressId } = await cartWith(v.id, 2);
    const order = (await agent.post('/api/orders').send({ addressId, paymentMethod: 'RAZORPAY' })).body.data;
    expect(order.status).toBe('PENDING');
    expect(await inventoryOf(v.id)).toMatchObject({ totalStock: 3, reservedStock: 2, availableStock: 1 });
    // Cart is kept until payment succeeds.
    expect(await prisma.cartItem.count()).toBe(1);

    await prisma.order.update({ where: { orderNumber: order.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expireStaleOrders()).toBe(1);
    expect(await inventoryOf(v.id)).toMatchObject({ totalStock: 3, reservedStock: 0, availableStock: 3 });
    const after = (await agent.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(after.status).toBe('CANCELLED');
    expect(after.paymentStatus).toBe('FAILED');
    // Running the job again is a no-op.
    expect(await expireStaleOrders()).toBe(0);
  });

  it('only lets customers see and cancel their own orders', async () => {
    const p = await createProduct({ stocks: [5] });
    const a = await cartWith(p.variants[0]!.id);
    const b = await customerAgent();
    const order = (await a.agent.post('/api/orders').send({ addressId: a.addressId, paymentMethod: 'COD' })).body.data;
    expect((await b.agent.get(`/api/orders/${order.orderNumber}`)).status).toBe(404);
    expect((await b.agent.post(`/api/orders/${order.orderNumber}/cancel`).send({ reason: 'not mine' })).status).toBe(404);
    expect((await a.agent.get('/api/orders')).body.data).toHaveLength(1);
  });

  it('rejects an address that belongs to another customer', async () => {
    const p = await createProduct();
    const a = await cartWith(p.variants[0]!.id);
    const b = await customerAgent();
    const res = await a.agent.post('/api/orders').send({ addressId: b.addressId, paymentMethod: 'COD' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('ADDRESS_NOT_FOUND');
  });

  it('serves a PDF invoice only to the order owner', async () => {
    const p = await createProduct();
    const a = await cartWith(p.variants[0]!.id);
    const b = await customerAgent();
    const order = (await a.agent.post('/api/orders').send({ addressId: a.addressId, paymentMethod: 'COD' })).body.data;
    const pdf = await a.agent.get(`/api/orders/${order.orderNumber}/invoice`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await b.agent.get(`/api/orders/${order.orderNumber}/invoice`)).status).toBe(404);
  });
});
