import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct, customerAgent, prisma, resetDb } from './helpers';
import { evaluateCoupon } from '../src/services/coupon.service';
import { lineTax, splitGst } from '../src/services/tax.service';

const H = { 'x-kc-client': 'test' };

describe('Tax service', () => {
  it('extracts GST from inclusive prices and adds it for exclusive prices', () => {
    expect(lineTax(11800, 18, true)).toBe(1800);
    expect(lineTax(10000, 18, false)).toBe(1800);
    expect(lineTax(10300, 3, true)).toBe(300);
    expect(lineTax(0, 18, true)).toBe(0);
  });
  it('splits intra-state GST into CGST/SGST and inter-state into IGST', () => {
    expect(splitGst(1801, 'Uttar Pradesh', 'Uttar Pradesh')).toMatchObject({ cgst: 900, sgst: 901, igst: 0 });
    expect(splitGst(1800, 'Delhi', 'Uttar Pradesh')).toMatchObject({ cgst: 0, sgst: 0, igst: 1800 });
  });
});

describe('Cart', () => {
  beforeEach(resetDb);

  it('adds items and computes totals from database prices only', async () => {
    const p = await createProduct({ price: 40000, mrp: 50000, gstRate: 18 });
    const { agent } = await customerAgent();
    // Client-supplied price fields are stripped by validation and never used.
    const add = await agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 2, price: 1 });
    expect(add.status).toBe(201);
    const s = add.body.data.summary;
    expect(s.subtotal).toBe(80000);
    expect(s.mrpTotal).toBe(100000);
    expect(s.productDiscount).toBe(20000);
    expect(s.shippingFee).toBe(7900); // below ₹999 free-shipping threshold
    expect(s.taxTotal).toBe(Math.round((80000 * 18) / 118));
    expect(s.grandTotal).toBe(80000 + 7900);
  });

  it('validates stock when adding and updating quantity', async () => {
    const p = await createProduct({ stocks: [3] });
    const { agent } = await customerAgent();
    const tooMany = await agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 4 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.errorCode).toBe('INSUFFICIENT_STOCK');

    const ok = await agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 2 });
    const itemId = ok.body.data.lines[0].itemId;
    const inc = await agent.patch(`/api/cart/items/${itemId}`).send({ quantity: 5 });
    expect(inc.status).toBe(409);
    const dec = await agent.patch(`/api/cart/items/${itemId}`).send({ quantity: 1 });
    expect(dec.body.data.summary.itemCount).toBe(1);
    const del = await agent.delete(`/api/cart/items/${itemId}`);
    expect(del.body.data.lines).toHaveLength(0);
  });

  it('reflects price changes and flags items that became unavailable', async () => {
    const p = await createProduct({ price: 40000, mrp: 50000 });
    const gone = await createProduct();
    const { agent } = await customerAgent();
    await agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 1 });
    await agent.post('/api/cart/items').send({ variantId: gone.variants[0]!.id, quantity: 1 });

    await prisma.product.update({ where: { id: p.id }, data: { price: 35000 } });
    await prisma.product.update({ where: { id: gone.id }, data: { isActive: false } });
    const cart = await agent.get('/api/cart');
    expect(cart.body.data.lines[0].unitPrice).toBe(35000);
    expect(cart.body.data.unavailable[0].issue).toBe('UNAVAILABLE');
    expect(cart.body.data.summary.subtotal).toBe(35000);
  });

  it('prices a guest cart and merges it into the account cart after login', async () => {
    const p = await createProduct({ price: 20000, mrp: 25000, stocks: [4] });
    const quote = await request(app).post('/api/cart/quote').set(H).send({ items: [{ variantId: p.variants[0]!.id, quantity: 2 }] });
    expect(quote.body.data.summary.subtotal).toBe(40000);

    const { agent } = await customerAgent();
    const merged = await agent.post('/api/cart/merge').send({ items: [{ variantId: p.variants[0]!.id, quantity: 9 }] });
    expect(merged.body.data.lines[0].quantity).toBe(4); // clamped to stock
  });

  it('gives free shipping above the threshold', async () => {
    const p = await createProduct({ price: 60000, mrp: 70000 });
    const { agent } = await customerAgent();
    const res = await agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 2 });
    expect(res.body.data.summary.shippingFee).toBe(0);
  });
});

describe('Coupons', () => {
  beforeEach(resetDb);

  async function coupon(data: Partial<Parameters<typeof prisma.coupon.create>[0]['data']> & { code: string }) {
    return prisma.coupon.create({ data: { type: 'PERCENTAGE', value: 10, ...data } as never });
  }

  it('applies percentage coupons with a maximum discount cap', async () => {
    await coupon({ code: 'WELCOME10', value: 10, maxDiscount: 5000, minCartValue: 10000 });
    const p = await createProduct({ price: 80000, mrp: 90000 });
    const { agent } = await customerAgent();
    await agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 1 });
    const res = await agent.post('/api/cart/coupon').send({ code: 'welcome10' });
    expect(res.status).toBe(200);
    expect(res.body.data.summary.couponDiscount).toBe(5000); // 10% of 800 = 80 → capped at 50
    expect(res.body.data.coupon.code).toBe('WELCOME10');
  });

  it('applies fixed coupons and enforces minimum cart value', async () => {
    await coupon({ code: 'FLAT100', type: 'FIXED', value: 10000, minCartValue: 99900 });
    const p = await createProduct({ price: 50000, mrp: 60000 });
    const { agent } = await customerAgent();
    await agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 1 });
    const low = await agent.post('/api/cart/coupon').send({ code: 'FLAT100' });
    expect(low.status).toBe(422);
    expect(low.body.errorCode).toBe('COUPON_MIN_CART');
    await agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 1 });
    const ok = await agent.post('/api/cart/coupon').send({ code: 'FLAT100' });
    expect(ok.body.data.summary.couponDiscount).toBe(10000);
  });

  it('rejects unknown, inactive, expired and not-yet-started coupons', async () => {
    const p = await createProduct();
    const lines = [{ productId: p.id, categoryId: p.categoryId, lineTotal: 40000 }];
    await coupon({ code: 'OFF', isActive: false });
    await coupon({ code: 'OLD', expiresAt: new Date(Date.now() - 1000) });
    await coupon({ code: 'SOON', startsAt: new Date(Date.now() + 86_400_000) });
    await expect(evaluateCoupon('NOPE', lines, undefined)).rejects.toMatchObject({ errorCode: 'COUPON_NOT_FOUND' });
    await expect(evaluateCoupon('OFF', lines, undefined)).rejects.toMatchObject({ errorCode: 'COUPON_INACTIVE' });
    await expect(evaluateCoupon('OLD', lines, undefined)).rejects.toMatchObject({ errorCode: 'COUPON_EXPIRED' });
    await expect(evaluateCoupon('SOON', lines, undefined)).rejects.toMatchObject({ errorCode: 'COUPON_NOT_STARTED' });
  });

  it('restricts category/product-specific coupons to eligible lines and allocates the discount exactly', async () => {
    const jewel = await createProduct({ categorySlug: 'artificial-jewellery', price: 100000, mrp: 120000 });
    const lip = await createProduct({ categorySlug: 'cosmetics', price: 50000, mrp: 60000 });
    const c = await coupon({ code: 'FESTIVE20', value: 20 });
    await prisma.couponCategory.create({ data: { couponId: c.id, categoryId: jewel.categoryId } });
    const lines = [
      { productId: jewel.id, categoryId: jewel.categoryId, lineTotal: 100000 },
      { productId: lip.id, categoryId: lip.categoryId, lineTotal: 50000 },
    ];
    const r = await evaluateCoupon('FESTIVE20', lines, undefined);
    expect(r.discount).toBe(20000);
    expect(r.allocations).toEqual([20000, 0]);
    await expect(evaluateCoupon('FESTIVE20', [lines[1]!], undefined)).rejects.toMatchObject({ errorCode: 'COUPON_NOT_APPLICABLE' });
  });

  it('enforces global and per-user usage limits', async () => {
    const p = await createProduct();
    const lines = [{ productId: p.id, categoryId: p.categoryId, lineTotal: 40000 }];
    await coupon({ code: 'LIMITED', usageLimit: 1, usedCount: 1 });
    await expect(evaluateCoupon('LIMITED', lines, undefined)).rejects.toMatchObject({ errorCode: 'COUPON_USAGE_LIMIT' });

    const once = await coupon({ code: 'ONCE', perUserLimit: 1 });
    const { user } = await customerAgent();
    const order = await prisma.order.create({
      data: {
        orderNumber: 'KC-2026-999999', userId: user.id, paymentMethod: 'COD', mrpTotal: 1, subtotal: 1, productDiscount: 0, taxTotal: 0, grandTotal: 1,
        shipName: 'x', shipPhone: 'x', shipHouse: 'x', shipStreet: 'x', shipCity: 'x', shipState: 'x', shipPincode: '242001',
      },
    });
    await prisma.couponUsage.create({ data: { couponId: once.id, userId: user.id, orderId: order.id, discount: 100 } });
    await expect(evaluateCoupon('ONCE', lines, user.id)).rejects.toMatchObject({ errorCode: 'COUPON_USER_LIMIT' });
  });

  it('validates coupons via POST /api/coupons/validate', async () => {
    await coupon({ code: 'TEN', value: 10 });
    const p = await createProduct({ price: 40000 });
    const res = await request(app).post('/api/coupons/validate').set(H).send({ code: 'TEN', items: [{ variantId: p.variants[0]!.id, quantity: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.discount).toBe(4000);
  });
});
