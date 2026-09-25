import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct, prisma, resetDb } from './helpers';

describe('Product API', () => {
  beforeEach(resetDb);

  it('lists active products with pagination metadata', async () => {
    for (let i = 0; i < 5; i++) await createProduct();
    const inactive = await createProduct({ name: 'Hidden Item' });
    await prisma.product.update({ where: { id: inactive.id }, data: { isActive: false } });

    const res = await request(app).get('/api/products?limit=2&page=2');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(res.body.data).toHaveLength(2);
    const all = await request(app).get('/api/products?limit=50');
    expect(all.body.data.map((p: { name: string }) => p.name)).not.toContain('Hidden Item');
  });

  it('filters by category, price range (rupees), color and availability through query params', async () => {
    await createProduct({ categorySlug: 'cosmetics', price: 15000, mrp: 20000, color: 'Red' });
    await createProduct({ categorySlug: 'cosmetics', price: 90000, mrp: 100000 });
    await createProduct({ categorySlug: 'lace', price: 30000, mrp: 40000, stocks: [0] });

    const cat = await request(app).get('/api/products?category=cosmetics&minPrice=100&maxPrice=1000&sort=price_asc');
    expect(cat.body.data.map((p: { price: number }) => p.price)).toEqual([15000, 90000]);

    const cheap = await request(app).get('/api/products?maxPrice=500');
    expect(cheap.body.meta.total).toBe(2);

    const red = await request(app).get('/api/products?color=red');
    expect(red.body.meta.total).toBe(1);

    const inStock = await request(app).get('/api/products?inStock=true');
    expect(inStock.body.meta.total).toBe(2);
    const outOfStock = await request(app).get('/api/products?inStock=false');
    expect(outOfStock.body.data[0].inStock).toBe(false);
  });

  it('sorts by price and discount', async () => {
    await createProduct({ price: 30000, mrp: 60000 }); // 50%
    await createProduct({ price: 10000, mrp: 11000 }); // 9%
    await createProduct({ price: 50000, mrp: 70000 }); // 29%
    const desc = await request(app).get('/api/products?sort=price_desc');
    expect(desc.body.data.map((p: { price: number }) => p.price)).toEqual([50000, 30000, 10000]);
    const disc = await request(app).get('/api/products?sort=discount');
    expect(disc.body.data.map((p: { discountPercent: number }) => p.discountPercent)).toEqual([50, 29, 9]);
  });

  it('searches by name, SKU, tag and category and returns suggestions', async () => {
    const lip = await createProduct({ name: 'Velvet Matte Lipstick', tags: ['lipstick', 'matte'] });
    await createProduct({ name: 'Kundan Earrings', categorySlug: 'artificial-jewellery', tags: ['kundan'] });

    expect((await request(app).get('/api/products?q=velvet')).body.meta.total).toBe(1);
    expect((await request(app).get(`/api/products?q=${lip.sku}`)).body.data[0].name).toBe('Velvet Matte Lipstick');
    expect((await request(app).get('/api/products?q=kundan')).body.meta.total).toBe(1);
    expect((await request(app).get('/api/products?q=Artificial')).body.meta.total).toBe(1);
    expect((await request(app).get('/api/products?q=nothingmatches')).body.data).toEqual([]);

    const sugg = await request(app).get('/api/search/suggestions?q=vel');
    expect(sugg.body.data.products[0].slug).toBe(lip.slug);
  });

  it('returns product details with variants and hides inactive products', async () => {
    const p = await createProduct({ stocks: [5, 1] });
    const res = await request(app).get(`/api/products/${p.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.variants).toHaveLength(2);
    expect(res.body.data.variants[1].lowStock).toBe(1);
    expect(res.body.data).not.toHaveProperty('deletedAt');

    await prisma.product.update({ where: { id: p.id }, data: { isActive: false } });
    const gone = await request(app).get(`/api/products/${p.slug}`);
    expect(gone.status).toBe(404);
    expect(gone.body).toEqual({ success: false, message: 'Product not found', errorCode: 'PRODUCT_NOT_FOUND' });
  });

  it('rejects invalid query parameters', async () => {
    const res = await request(app).get('/api/products?sort=bogus');
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });
});
