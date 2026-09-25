import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { adminAgent, app, createProduct, customerAgent, inventoryOf, loginAgent, prisma, resetDb, createUser } from './helpers';
import { setRazorpayClient } from '../src/services/payments/razorpay.gateway';
import { hmacSha256Hex } from '../src/utils/crypto';

const refunds: string[] = [];
beforeAll(() =>
  setRazorpayClient({
    createOrder: async (i) => ({ id: `order_adm_${Date.now()}`, amount: i.amount, currency: i.currency }),
    fetchOrderPayments: async () => [],
    refund: async (paymentId) => {
      refunds.push(paymentId);
      return { id: `rfnd_${paymentId}`, status: 'processed' };
    },
  }),
);
afterAll(() => setRazorpayClient(null));

async function category() {
  return prisma.category.create({ data: { name: 'Cosmetics', slug: 'cosmetics', subcategories: { create: { name: 'Lipsticks', slug: 'lipsticks' } } }, include: { subcategories: true } });
}

async function codOrder(stock = 5, qty = 1) {
  const p = await createProduct({ stocks: [stock] });
  const c = await customerAgent();
  await c.agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: qty });
  const order = (await c.agent.post('/api/orders').send({ addressId: c.addressId, paymentMethod: 'COD' })).body.data;
  return { ...c, order, product: p };
}

describe('Admin products & categories', () => {
  beforeEach(resetDb);

  it('creates a product with variants, images and initial stock (with audit trail)', async () => {
    const { agent } = await adminAgent();
    const cat = await category();
    const res = await agent.post('/api/admin/products').send({
      name: 'Velvet Matte Lipstick',
      sku: 'LIP-001',
      description: 'A lovely long-lasting lipstick.',
      categoryId: cat.id,
      subcategoryId: cat.subcategories[0]!.id,
      mrp: 59900,
      price: 44900,
      gstRate: 18,
      tags: ['Lipstick', 'matte'],
      images: [{ url: 'https://res.cloudinary.com/demo/image/upload/lip.jpg', publicId: 'kc/lip', altText: 'Lipstick' }],
      specifications: [{ label: 'Finish', value: 'Matte' }],
      variants: [
        { sku: 'LIP-001-RED', name: 'Ruby Red', color: 'Red', colorHex: '#9B1B30', initialStock: 20 },
        { sku: 'LIP-001-NUDE', name: 'Nude', color: 'Nude', initialStock: 0 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('velvet-matte-lipstick');
    expect(res.body.data.discountPercent).toBe(25);
    expect(res.body.data.tags).toEqual(['lipstick', 'matte']);
    expect(res.body.data.variants).toHaveLength(2);
    const red = res.body.data.variants.find((v: { sku: string }) => v.sku === 'LIP-001-RED');
    expect(red.inventory).toMatchObject({ totalStock: 20, availableStock: 20 });
    expect(await prisma.inventoryTransaction.count({ where: { type: 'RESTOCK' } })).toBe(1);

    const publicView = await request(app).get('/api/products/velvet-matte-lipstick');
    expect(publicView.status).toBe(200);
  });

  it('validates price <= MRP and category ownership', async () => {
    const { agent } = await adminAgent();
    const cat = await category();
    const bad = await agent.post('/api/admin/products').send({ name: 'Bad', sku: 'BAD-1', description: 'Bad pricing here', categoryId: cat.id, mrp: 100, price: 200 });
    expect(bad.status).toBe(400);
    const wrongCat = await agent.post('/api/admin/products').send({ name: 'Bad', sku: 'BAD-2', description: 'Bad category here', categoryId: 'nope', mrp: 200, price: 100 });
    expect(wrongCat.body.errorCode).toBe('INVALID_CATEGORY');
  });

  it('price updates flow through to carts; deleting a product archives it but keeps order history', async () => {
    const { agent } = await adminAgent();
    const { agent: customer, order, product } = await codOrder();
    const upd = await agent.patch(`/api/admin/products/${product.id}`).send({ price: 30000 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.price).toBe(30000);

    const del = await agent.delete(`/api/admin/products/${product.id}`);
    expect(del.status).toBe(200);
    const archived = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(archived.deletedAt).not.toBeNull();
    expect(archived.isActive).toBe(false);
    expect((await request(app).get(`/api/products/${product.slug}`)).status).toBe(404);
    // Historical order still intact with snapshot data.
    const o = (await customer.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(o.items[0].productName).toBe(product.name);
    expect(o.items[0].unitPrice).toBe(40000);
  });

  it('refuses to delete a category that still has products, and soft-deletes empty ones', async () => {
    const { agent } = await adminAgent();
    const p = await createProduct();
    expect((await agent.delete(`/api/admin/categories/${p.categoryId}`)).body.errorCode).toBe('CATEGORY_NOT_EMPTY');
    const empty = await agent.post('/api/admin/categories').send({ name: 'Bridal Collection' });
    expect(empty.body.data.slug).toBe('bridal-collection');
    const sub = await agent.post('/api/admin/subcategories').send({ name: 'Sets', categoryId: empty.body.data.id });
    expect(sub.status).toBe(201);
    expect((await agent.delete(`/api/admin/categories/${empty.body.data.id}`)).status).toBe(200);
    expect((await request(app).get('/api/categories')).body.data.map((c: { slug: string }) => c.slug)).not.toContain('bridal-collection');
  });
});

describe('Admin orders', () => {
  beforeEach(resetDb);

  it('enforces valid status transitions', async () => {
    const { agent } = await adminAgent();
    const { order } = await codOrder();
    const skip = await agent.patch(`/api/admin/orders/${order.orderNumber}/status`).send({ status: 'DELIVERED' });
    expect(skip.status).toBe(422);
    expect(skip.body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    const paid = await agent.patch(`/api/admin/orders/${order.orderNumber}/status`).send({ status: 'PAID' });
    expect(paid.status).toBe(422);
    const ok = await agent.patch(`/api/admin/orders/${order.orderNumber}/status`).send({ status: 'PROCESSING', note: 'Packing today' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.allowedTransitions).toEqual(['PACKED', 'CANCELLED']);
  });

  it('admin cancellation restocks committed stock', async () => {
    const { agent } = await adminAgent();
    const { order, product } = await codOrder(5, 2);
    expect(await inventoryOf(product.variants[0]!.id)).toMatchObject({ totalStock: 3 });
    const res = await agent.patch(`/api/admin/orders/${order.orderNumber}/status`).send({ status: 'CANCELLED', note: 'Customer called' });
    expect(res.body.data.status).toBe('CANCELLED');
    expect(await inventoryOf(product.variants[0]!.id)).toMatchObject({ totalStock: 5, availableStock: 5, reservedStock: 0 });
  });

  it('searches and filters orders', async () => {
    const { agent } = await adminAgent();
    const { order } = await codOrder();
    await codOrder();
    const byNumber = await agent.get(`/api/admin/orders?q=${order.orderNumber}`);
    expect(byNumber.body.meta.total).toBe(1);
    const byStatus = await agent.get('/api/admin/orders?status=CONFIRMED&paymentMethod=COD');
    expect(byStatus.body.meta.total).toBe(2);
    const detail = await agent.get(`/api/admin/orders/${order.orderNumber}`);
    expect(detail.body.data.user.email).toBeDefined();
    expect(JSON.stringify(detail.body)).not.toMatch(/passwordHash/);
  });

  it('full return flow: request → approve → receive (restock) → refund', async () => {
    const { agent: admin } = await adminAgent();
    const { agent, order, product } = await codOrder(5, 1);
    for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) await admin.patch(`/api/admin/orders/${order.orderNumber}/status`).send({ status });

    const ret = await agent.post(`/api/orders/${order.orderNumber}/return`).send({ reason: 'Colour not as expected' });
    expect(ret.body.data.status).toBe('RETURN_REQUESTED');
    expect((await agent.post(`/api/orders/${order.orderNumber}/return`).send({ reason: 'again' })).status).toBe(422);

    const returns = await admin.get('/api/admin/returns');
    const returnId = returns.body.data[0].id;
    await admin.patch(`/api/admin/returns/${returnId}`).send({ action: 'APPROVE' });
    await admin.patch(`/api/admin/returns/${returnId}`).send({ action: 'RECEIVE', note: 'Item OK' });
    expect(await inventoryOf(product.variants[0]!.id)).toMatchObject({ totalStock: 5, availableStock: 5 });

    const refundList = await admin.get('/api/admin/refunds?status=PENDING');
    expect(refundList.body.data).toHaveLength(1);
    const refundId = refundList.body.data[0].id;
    // COD refunds are manual and need a bank/UPI reference.
    expect((await admin.post(`/api/admin/refunds/${refundId}/process`).send({})).body.errorCode).toBe('MANUAL_REFERENCE_REQUIRED');
    const done = await admin.post(`/api/admin/refunds/${refundId}/process`).send({ manualReference: 'UPI-123456' });
    expect(done.status).toBe(200);
    expect((await admin.post(`/api/admin/refunds/${refundId}/process`).send({ manualReference: 'x' })).status).toBe(409);

    const o = (await agent.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(o.status).toBe('REFUNDED');
    expect(o.paymentStatus).toBe('REFUNDED');
    expect(o.refunds[0].amount).toBe(o.grandTotal - o.shippingFee - o.codFee);
  });

  it('refunds a cancelled prepaid order through the gateway', async () => {
    const { agent: admin } = await adminAgent();
    const p = await createProduct({ stocks: [5] });
    const c = await customerAgent();
    await c.agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 1 });
    const order = (await c.agent.post('/api/orders').send({ addressId: c.addressId, paymentMethod: 'RAZORPAY' })).body.data;
    const rzp = (await c.agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).body.data.razorpayOrderId;
    await c.agent.post('/api/payments/razorpay/verify').send({
      orderNumber: order.orderNumber,
      razorpayOrderId: rzp,
      razorpayPaymentId: 'pay_refundme',
      razorpaySignature: hmacSha256Hex(process.env.RAZORPAY_KEY_SECRET!, `${rzp}|pay_refundme`),
    });
    const cancel = await c.agent.post(`/api/orders/${order.orderNumber}/cancel`).send({ reason: 'Found it cheaper' });
    expect(cancel.body.data.refunds).toHaveLength(1);
    const refundId = cancel.body.data.refunds[0].id;
    await admin.post(`/api/admin/refunds/${refundId}/process`).send({});
    expect(refunds).toContain('pay_refundme');
    const o = (await c.agent.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(o).toMatchObject({ status: 'REFUNDED', paymentStatus: 'REFUNDED' });
    expect(o.payments[0].status).toBe('REFUNDED');
  });
});

describe('Admin inventory, customers, reviews, dashboard', () => {
  beforeEach(resetDb);

  it('adjusts stock with an audit trail and never allows negative available stock', async () => {
    const { agent } = await adminAgent();
    const p = await createProduct({ stocks: [3] });
    const v = p.variants[0]!;
    const add = await agent.post('/api/admin/inventory/adjust').send({ variantId: v.id, delta: 10, type: 'RESTOCK', reason: 'New shipment' });
    expect(add.body.data).toMatchObject({ totalStock: 13, availableStock: 13 });
    const tooMuch = await agent.post('/api/admin/inventory/adjust').send({ variantId: v.id, delta: -20, reason: 'Damaged' });
    expect(tooMuch.body.errorCode).toBe('INVALID_STOCK_ADJUSTMENT');
    const history = await agent.get(`/api/admin/inventory/${v.id}/history`);
    expect(history.body.data.items[0]).toMatchObject({ type: 'RESTOCK', quantity: 10, reason: 'New shipment' });

    await agent.post('/api/admin/inventory/adjust').send({ variantId: v.id, delta: -12, reason: 'Stock count correction' });
    const low = await agent.get('/api/admin/inventory?lowStock=true');
    expect(low.body.data).toHaveLength(1);
    expect(low.body.data[0].isLowStock).toBe(true);
  });

  it('deactivating a customer blocks login and revokes sessions', async () => {
    const { agent: admin } = await adminAgent();
    const { user, password } = await createUser();
    const session = await loginAgent(user.email, password);
    await admin.patch(`/api/admin/customers/${user.id}/status`).send({ isActive: false });
    expect((await session.get('/api/me')).status).toBe(401);
    const login = await request(app).post('/api/auth/login').set('x-kc-client', 't').send({ email: user.email, password });
    expect(login.status).toBe(403);
  });

  it('marks verified purchase reviews, prevents duplicates and supports moderation', async () => {
    const { agent: admin } = await adminAgent();
    const { agent, order, product } = await codOrder();
    const early = await agent.post('/api/reviews').send({ productId: product.id, orderItemId: order.items[0].id, rating: 5, body: 'Lovely product, great quality!' });
    expect(early.body.errorCode).toBe('REVIEW_NOT_ELIGIBLE');

    for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) await admin.patch(`/api/admin/orders/${order.orderNumber}/status`).send({ status });
    const rev = await agent.post('/api/reviews').send({ productId: product.id, rating: 4, title: 'Nice', body: 'Lovely product, great quality!' });
    expect(rev.status).toBe(201);
    expect(rev.body.data).toMatchObject({ isVerifiedPurchase: true, status: 'APPROVED' });
    const dup = await agent.post('/api/reviews').send({ productId: product.id, rating: 5, body: 'Posting again for the same item' });
    expect(dup.body.errorCode).toBe('DUPLICATE_REVIEW');

    const other = await customerAgent();
    const unverified = await other.agent.post('/api/reviews').send({ productId: product.id, rating: 1, body: 'Never bought it but reviewing' });
    expect(unverified.body.data).toMatchObject({ isVerifiedPurchase: false, status: 'PENDING' });

    let pub = await request(app).get(`/api/products/${product.slug}/reviews`);
    expect(pub.body.data.items).toHaveLength(1);
    expect(pub.body.data.summary).toEqual({ ratingAvg: 4, ratingCount: 1 });

    await admin.patch(`/api/admin/reviews/${unverified.body.data.id}`).send({ status: 'APPROVED' });
    pub = await request(app).get(`/api/products/${product.slug}/reviews`);
    expect(pub.body.data.summary).toEqual({ ratingAvg: 2.5, ratingCount: 2 });
    await admin.patch(`/api/admin/reviews/${rev.body.data.id}`).send({ status: 'HIDDEN' });
    await admin.delete(`/api/admin/reviews/${unverified.body.data.id}`);
    pub = await request(app).get(`/api/products/${product.slug}/reviews`);
    expect(pub.body.data.summary).toEqual({ ratingAvg: 0, ratingCount: 0 });
  });

  it('returns dashboard statistics and chart series', async () => {
    const { agent } = await adminAgent();
    await codOrder();
    const res = await agent.get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.stats.todayOrders).toBe(1);
    expect(res.body.data.stats.totalCustomers).toBe(1);
    expect(res.body.data.charts.dailySales).toHaveLength(30);
    expect(res.body.data.charts.monthlySales).toHaveLength(12);
    expect(res.body.data.charts.paymentMethods[0].method).toBe('COD');
  });

  it('updates COD & shipping settings with validation', async () => {
    const { agent } = await adminAgent();
    const bad = await agent.patch('/api/admin/settings').send({ codMinOrderValue: 500000, codMaxOrderValue: 1000 });
    expect(bad.body.errorCode).toBe('INVALID_SETTINGS');
    const ok = await agent.patch('/api/admin/settings').send({ codEnabled: false, flatShippingFee: 5000 });
    expect(ok.body.data).toMatchObject({ codEnabled: false, flatShippingFee: 5000 });
    const pub = await request(app).get('/api/settings/public');
    expect(pub.body.data.codEnabled).toBe(false);
  });
});
