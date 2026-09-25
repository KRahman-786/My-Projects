import request from 'supertest';
type TestAgent = ReturnType<typeof request.agent>;
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/services/auth.service';
import { clearSettingsCache } from '../src/services/settings.service';

export const app = createApp();
export { prisma };

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await prisma.storeSettings.create({ data: { id: 1 } });
  clearSettingsCache();
}

let userSeq = 0;
export async function createUser(opts: { role?: 'ADMIN' | 'CUSTOMER'; password?: string; email?: string } = {}) {
  userSeq++;
  const password = opts.password ?? 'Password123';
  const user = await prisma.user.create({
    data: {
      name: `Test User ${userSeq}`,
      email: opts.email ?? `user${userSeq}-${Date.now()}@example.com`,
      phone: '9876543210',
      passwordHash: await hashPassword(password),
      role: opts.role ?? 'CUSTOMER',
      cart: { create: {} },
      wishlist: { create: {} },
      addresses: {
        create: { name: 'Test User', phone: '9876543210', house: '1', street: 'Main Road', city: 'Shahjahanpur', state: 'Uttar Pradesh', pincode: '242001', isDefault: true },
      },
    },
    include: { addresses: true },
  });
  return { user, password, addressId: user.addresses[0]!.id };
}

/** Logged-in supertest agent (cookie session) that sends the CSRF client header. */
export async function loginAgent(email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').set('x-kc-client', 'test').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return withHeader(agent);
}

export function withHeader(agent: TestAgent) {
  return {
    get: (url: string) => agent.get(url).set('x-kc-client', 'test'),
    post: (url: string) => agent.post(url).set('x-kc-client', 'test'),
    patch: (url: string) => agent.patch(url).set('x-kc-client', 'test'),
    put: (url: string) => agent.put(url).set('x-kc-client', 'test'),
    delete: (url: string) => agent.delete(url).set('x-kc-client', 'test'),
  };
}

export async function customerAgent(opts: { email?: string } = {}) {
  const { user, password, addressId } = await createUser(opts);
  return { user, addressId, agent: await loginAgent(user.email, password) };
}

export async function adminAgent() {
  const { user, password } = await createUser({ role: 'ADMIN' });
  return { user, agent: await loginAgent(user.email, password) };
}

let productSeq = 0;
/** Creates an active product with one variant per entry of `stocks`. Prices in paise. */
export async function createProduct(opts: { price?: number; mrp?: number; stocks?: number[]; gstRate?: number; categorySlug?: string; name?: string; tags?: string[]; color?: string } = {}) {
  productSeq++;
  const slug = opts.categorySlug ?? 'cosmetics';
  const category = await prisma.category.upsert({ where: { slug }, update: {}, create: { name: slug[0]!.toUpperCase() + slug.slice(1), slug } });
  const stocks = opts.stocks ?? [10];
  const name = opts.name ?? `Test Product ${productSeq}`;
  return prisma.product.create({
    data: {
      name,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${productSeq}`,
      sku: `SKU-${productSeq}-${Date.now()}`,
      description: 'A lovely test product description',
      categoryId: category.id,
      mrp: opts.mrp ?? 50000,
      price: opts.price ?? 40000,
      discountPercent: Math.round((((opts.mrp ?? 50000) - (opts.price ?? 40000)) / (opts.mrp ?? 50000)) * 100),
      gstRate: opts.gstRate ?? 18,
      tags: opts.tags ?? ['test'],
      variants: {
        create: stocks.map((s, i) => ({
          sku: `VAR-${productSeq}-${i}-${Date.now()}`,
          name: i === 0 ? 'Standard' : `Variant ${i}`,
          color: opts.color,
          inventory: { create: { totalStock: s, availableStock: s, reservedStock: 0, lowStockThreshold: 2 } },
        })),
      },
    },
    include: { variants: { include: { inventory: true }, orderBy: { sku: 'asc' } }, category: true },
  });
}

export async function inventoryOf(variantId: string) {
  return prisma.inventory.findUniqueOrThrow({ where: { variantId } });
}
