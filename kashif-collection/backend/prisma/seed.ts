/* eslint-disable no-console */
/**
 * Development seed. Wipes and recreates all data.
 * Orders are created through the real order service so inventory ledgers, coupons and history stay consistent.
 */
process.env.SEED_MODE = '1';

import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/services/auth.service';
import { createProduct } from '../src/services/product.service';
import { createOrder, updateOrderStatus } from '../src/services/order.service';
import { addItem } from '../src/services/cart.service';
import { createReview } from '../src/services/review.service';
import { clearSettingsCache } from '../src/services/settings.service';
import { slugify } from '../src/utils/slug';
import { categories, customers, products, reviewTexts } from './seed-data';

const DEV_ADMIN = { email: 'admin@kashifcollection.in', password: 'Admin@12345', name: 'Kashif Admin' };
const DEV_CUSTOMER_PASSWORD = 'Customer@123';

const rupees = (r: number) => Math.round(r * 100);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

// Deterministic PRNG so every seed produces the same data.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

async function wipe() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed a production database. Set SEED_ALLOW_PRODUCTION=true if you really mean it.');
  }

  console.log('🧹 Clearing database…');
  await wipe();
  clearSettingsCache();

  console.log('⚙️  Store settings & pincode rules');
  await prisma.storeSettings.create({ data: { id: 1 } });
  await prisma.serviceablePincode.createMany({
    data: [
      { pincode: '242001', city: 'Shahjahanpur', state: 'Uttar Pradesh', deliveryDays: 1 },
      { pincode: '744101', city: 'Port Blair', state: 'Andaman and Nicobar Islands', codAvailable: false, deliveryDays: 10 },
      { pincode: '194101', city: 'Leh', state: 'Ladakh', isServiceable: false, codAvailable: false, deliveryDays: 12 },
    ],
  });

  console.log('👤 Users');
  const admin = await prisma.user.create({
    data: { name: DEV_ADMIN.name, email: DEV_ADMIN.email, passwordHash: await hashPassword(DEV_ADMIN.password), role: 'ADMIN', cart: { create: {} }, wishlist: { create: {} } },
  });
  const customerHash = await hashPassword(DEV_CUSTOMER_PASSWORD);
  const users = [];
  for (const [i, c] of customers.entries()) {
    const user = await prisma.user.create({
      data: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        passwordHash: customerHash,
        createdAt: daysAgo(90 - i * 10),
        cart: { create: {} },
        wishlist: { create: {} },
        addresses: {
          create: {
            name: c.name,
            phone: c.phone,
            house: `${12 + i * 7}, ${pick(['Rose Villa', 'Shanti Kunj', 'Noor Manzil', 'Green Park Apartments', 'Sai Residency'])}`,
            street: pick(['MG Road', 'Station Road', 'Civil Lines', 'Gandhi Nagar', 'Nehru Marg']),
            area: pick(['Model Town', 'Sadar Bazaar', 'Aliganj', 'Jamia Nagar', 'Bandra West']),
            landmark: pick(['Near Jama Masjid', 'Opp. City Mall', 'Behind Post Office', undefined]),
            city: c.city,
            state: c.state ?? 'Uttar Pradesh',
            pincode: c.pincode,
            isDefault: true,
          },
        },
      },
      include: { addresses: true },
    });
    users.push(user);
  }

  console.log('🗂️  Categories');
  const categoryIds = new Map<string, string>();
  const subcategoryIds = new Map<string, string>();
  for (const [ci, c] of categories.entries()) {
    const cat = await prisma.category.create({ data: { name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, sortOrder: ci } });
    categoryIds.set(c.slug, cat.id);
    for (const [si, [name, slug]] of c.subcategories.entries()) {
      const sub = await prisma.subcategory.create({ data: { categoryId: cat.id, name, slug, sortOrder: si } });
      subcategoryIds.set(`${c.slug}/${slug}`, sub.id);
    }
  }

  console.log(`💄 Products (${products.length})`);
  const productIds = new Map<string, string>();
  for (const p of products) {
    const slug = slugify(p.name);
    const created = await createProduct(
      {
        name: p.name,
        slug,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription,
        categoryId: categoryIds.get(p.category)!,
        subcategoryId: subcategoryIds.get(`${p.category}/${p.subcategory}`)!,
        brand: p.brand,
        mrp: rupees(p.mrp),
        price: rupees(p.price),
        gstRate: p.gstRate,
        hsnCode: p.hsnCode,
        weightGrams: p.weightGrams,
        tags: p.tags,
        ingredients: p.ingredients,
        howToUse: p.howToUse,
        isFeatured: p.featured ?? false,
        isBestSeller: p.bestSeller ?? false,
        isNewArrival: p.newArrival ?? false,
        isActive: true,
        images: [1, 2, 3].map((n) => ({ url: `/images/products/${slug}-${n}.svg`, altText: `${p.name} — image ${n}`, publicId: null })),
        specifications: p.specifications.map(([label, value]) => ({ label, value })),
        variants: p.variants.map((v, i) => ({
          sku: `${p.sku}-${String(i + 1).padStart(2, '0')}`,
          name: v.name,
          color: v.color,
          colorHex: v.colorHex,
          size: v.size,
          price: v.price !== undefined ? rupees(v.price) : null,
          mrp: v.mrp !== undefined ? rupees(v.mrp) : null,
          initialStock: v.stock,
          lowStockThreshold: 5,
        })),
      },
      admin.id,
    );
    await prisma.product.update({ where: { id: created.id }, data: { createdAt: daysAgo(p.createdDaysAgo) } });
    productIds.set(p.sku, created.id);
  }

  console.log('🏷️  Coupons');
  const in60 = new Date(Date.now() + 60 * 86_400_000);
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', description: '10% off your first order (up to ₹200)', type: 'PERCENTAGE', value: 10, minCartValue: rupees(499), maxDiscount: rupees(200), perUserLimit: 1 },
      { code: 'FLAT100', description: 'Flat ₹100 off on orders above ₹999', type: 'FIXED', value: rupees(100), minCartValue: rupees(999), perUserLimit: 3 },
      { code: 'FESTIVE20', description: '20% off Artificial Jewellery (up to ₹500)', type: 'PERCENTAGE', value: 20, minCartValue: rupees(1499), maxDiscount: rupees(500), perUserLimit: 2, usageLimit: 500, expiresAt: in60 },
      { code: 'LACELOVE15', description: '15% off all Lace', type: 'PERCENTAGE', value: 15, minCartValue: rupees(299), maxDiscount: rupees(300), perUserLimit: 5 },
      { code: 'SUMMER5', description: 'Expired summer offer', type: 'PERCENTAGE', value: 5, expiresAt: daysAgo(30), isActive: true },
    ],
  });
  const festive = await prisma.coupon.findUniqueOrThrow({ where: { code: 'FESTIVE20' } });
  const lace = await prisma.coupon.findUniqueOrThrow({ where: { code: 'LACELOVE15' } });
  await prisma.couponCategory.createMany({
    data: [
      { couponId: festive.id, categoryId: categoryIds.get('artificial-jewellery')! },
      { couponId: lace.id, categoryId: categoryIds.get('lace')! },
    ],
  });

  console.log('🧾 Orders (via order service)');
  const variants = await prisma.productVariant.findMany({ where: { inventory: { availableStock: { gte: 5 } } }, select: { id: true, productId: true } });
  let orderCount = 0;
  const deliveredOrders: { userId: string; orderNumber: string }[] = [];
  for (let n = 0; n < 24; n++) {
    const user = users[n % users.length]!;
    const lines = 1 + Math.floor(rand() * 3);
    for (let l = 0; l < lines; l++) await addItem(user.id, pick(variants).id, 1 + Math.floor(rand() * 2)).catch(() => undefined);
    const { order } = await createOrder(user.id, { addressId: user.addresses[0]!.id, paymentMethod: 'COD', couponCode: n % 5 === 0 ? 'FLAT100' : null }).catch(
      async () => createOrder(user.id, { addressId: user.addresses[0]!.id, paymentMethod: 'COD', couponCode: null }),
    );
    orderCount++;
    const age = Math.floor(rand() * 55) + 1;
    const flow = n < 14 ? ['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] : n < 18 ? ['PROCESSING', 'PACKED', 'SHIPPED'] : n < 21 ? ['PROCESSING'] : [];
    for (const status of flow) {
      await updateOrderStatus(order.orderNumber, { status: status as never, trackingNumber: status === 'SHIPPED' ? `EK${100000000 + n}IN` : undefined }, admin.id);
    }
    const placed = daysAgo(age);
    await prisma.order.update({
      where: { orderNumber: order.orderNumber },
      data: {
        placedAt: placed,
        createdAt: placed,
        ...(flow.includes('DELIVERED') ? { deliveredAt: new Date(placed.getTime() + 4 * 86_400_000), shippedAt: new Date(placed.getTime() + 86_400_000) } : {}),
      },
    });
    if (flow.includes('DELIVERED')) deliveredOrders.push({ userId: user.id, orderNumber: order.orderNumber });
  }
  // One customer-cancelled order to demonstrate stock release.
  {
    const user = users[1]!;
    await addItem(user.id, pick(variants).id, 1).catch(() => undefined);
    const { order } = await createOrder(user.id, { addressId: user.addresses[0]!.id, paymentMethod: 'COD' });
    const { cancelOrder } = await import('../src/services/order.service');
    await cancelOrder(order.orderNumber, { userId: user.id, isAdmin: false }, 'Ordered by mistake');
    orderCount++;
  }

  console.log('⭐ Reviews');
  let reviewCount = 0;
  for (const d of deliveredOrders) {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: d.orderNumber }, include: { items: true } });
    for (const item of order.items) {
      if (rand() < 0.25) continue;
      const t = pick(reviewTexts);
      await createReview(d.userId, { productId: item.productId, orderItemId: item.id, rating: t.rating, title: t.title, body: t.body })
        .then(() => reviewCount++)
        .catch(() => undefined);
    }
  }

  // Leave a couple of items in carts / wishlists for demo accounts.
  const priya = users[0]!;
  await addItem(priya.id, pick(variants).id, 1).catch(() => undefined);
  const wl = await prisma.wishlist.findUniqueOrThrow({ where: { userId: priya.id } });
  await prisma.wishlistItem.createMany({ data: [...productIds.values()].slice(0, 3).map((productId) => ({ wishlistId: wl.id, productId })), skipDuplicates: true });

  console.log(`\n✅ Seed complete: ${products.length} products, ${users.length} customers, ${orderCount} orders, ${reviewCount} reviews.`);
  console.log('\n   DEVELOPMENT CREDENTIALS (never use in production):');
  console.log(`   Admin    → ${DEV_ADMIN.email} / ${DEV_ADMIN.password}`);
  console.log(`   Customer → ${customers[0]!.email} / ${DEV_CUSTOMER_PASSWORD}  (all seeded customers share this password)\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
