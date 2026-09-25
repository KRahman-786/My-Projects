import type { InventoryTransactionType } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { buildMeta, getPagination } from '../utils/pagination';
import { notifyAdmins } from './notification.service';

interface InventoryRow {
  id: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
}

interface MovementContext {
  orderId?: string;
  performedById?: string;
  reason?: string;
}

async function record(tx: Tx, row: InventoryRow, type: InventoryTransactionType, quantity: number, ctx: MovementContext) {
  await tx.inventoryTransaction.create({
    data: {
      inventoryId: row.id,
      type,
      quantity,
      totalAfter: row.totalStock,
      reservedAfter: row.reservedStock,
      reason: ctx.reason,
      orderId: ctx.orderId,
      performedById: ctx.performedById,
    },
  });
}

/**
 * Atomically reserves stock. The conditional UPDATE takes a row lock, so two concurrent checkouts for the
 * last unit are serialised by PostgreSQL: exactly one succeeds, the other sees availableStock < qty.
 */
export async function reserveStock(tx: Tx, variantId: string, quantity: number, ctx: MovementContext & { label?: string }) {
  const rows = await tx.$queryRaw<InventoryRow[]>`
    UPDATE "inventory"
       SET "reservedStock" = "reservedStock" + ${quantity},
           "availableStock" = "availableStock" - ${quantity},
           "updatedAt" = NOW()
     WHERE "variantId" = ${variantId} AND "availableStock" >= ${quantity}
     RETURNING "id", "totalStock", "reservedStock", "availableStock", "lowStockThreshold"`;
  const row = rows[0];
  if (!row) {
    throw AppError.conflict(
      `${ctx.label ?? 'An item in your cart'} is out of stock or does not have enough quantity available`,
      'OUT_OF_STOCK',
      { variantId },
    );
  }
  await record(tx, row, 'RESERVE', quantity, ctx);
  return row;
}

export async function releaseStock(tx: Tx, variantId: string, quantity: number, ctx: MovementContext) {
  const rows = await tx.$queryRaw<InventoryRow[]>`
    UPDATE "inventory"
       SET "reservedStock" = "reservedStock" - ${quantity},
           "availableStock" = "availableStock" + ${quantity},
           "updatedAt" = NOW()
     WHERE "variantId" = ${variantId} AND "reservedStock" >= ${quantity}
     RETURNING "id", "totalStock", "reservedStock", "availableStock", "lowStockThreshold"`;
  if (!rows[0]) throw new Error(`Inventory release failed for variant ${variantId}`);
  await record(tx, rows[0], 'RELEASE', -quantity, ctx);
}

/** Converts reserved units into a sale (removes them from total stock). */
export async function commitStock(tx: Tx, variantId: string, quantity: number, ctx: MovementContext) {
  const rows = await tx.$queryRaw<InventoryRow[]>`
    UPDATE "inventory"
       SET "reservedStock" = "reservedStock" - ${quantity},
           "totalStock" = "totalStock" - ${quantity},
           "updatedAt" = NOW()
     WHERE "variantId" = ${variantId} AND "reservedStock" >= ${quantity}
     RETURNING "id", "totalStock", "reservedStock", "availableStock", "lowStockThreshold"`;
  const row = rows[0];
  if (!row) throw new Error(`Inventory commit failed for variant ${variantId}`);
  await record(tx, row, 'SALE', -quantity, ctx);
  if (row.availableStock <= row.lowStockThreshold) {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId }, select: { sku: true, product: { select: { name: true } } } });
    await notifyAdmins(
      {
        type: 'INVENTORY',
        title: row.availableStock === 0 ? 'Out of stock' : 'Low stock',
        message: `${variant?.product.name ?? 'Product'} (${variant?.sku}) has ${row.availableStock} units available.`,
        link: '/admin/inventory?lowStock=true',
      },
      tx,
    );
  }
}

/** Puts previously sold units back on the shelf (cancellation after commit, or a received return). */
export async function restock(tx: Tx, variantId: string, quantity: number, type: 'RETURN' | 'CANCEL_RESTOCK', ctx: MovementContext) {
  const rows = await tx.$queryRaw<InventoryRow[]>`
    UPDATE "inventory"
       SET "totalStock" = "totalStock" + ${quantity},
           "availableStock" = "availableStock" + ${quantity},
           "updatedAt" = NOW()
     WHERE "variantId" = ${variantId}
     RETURNING "id", "totalStock", "reservedStock", "availableStock", "lowStockThreshold"`;
  if (!rows[0]) throw new Error(`Inventory restock failed for variant ${variantId}`);
  await record(tx, rows[0], type, quantity, ctx);
}

/** Admin stock adjustment. `delta` may be negative but can never push available stock below zero. */
export async function adjustStock(input: {
  variantId: string;
  delta: number;
  type: 'RESTOCK' | 'ADJUSTMENT';
  reason: string;
  performedById: string;
  lowStockThreshold?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const exists = await tx.inventory.findUnique({ where: { variantId: input.variantId } });
    if (!exists) throw AppError.notFound('Inventory record not found for this variant', 'INVENTORY_NOT_FOUND');
    let row: InventoryRow = exists;
    if (input.delta !== 0) {
      const rows = await tx.$queryRaw<InventoryRow[]>`
        UPDATE "inventory"
           SET "totalStock" = "totalStock" + ${input.delta},
               "availableStock" = "availableStock" + ${input.delta},
               "updatedAt" = NOW()
         WHERE "variantId" = ${input.variantId} AND "availableStock" + ${input.delta} >= 0
         RETURNING "id", "totalStock", "reservedStock", "availableStock", "lowStockThreshold"`;
      if (!rows[0]) {
        throw AppError.badRequest('Adjustment would make available stock negative (reserved units cannot be removed)', 'INVALID_STOCK_ADJUSTMENT');
      }
      row = rows[0];
      await record(tx, row, input.type, input.delta, { reason: input.reason, performedById: input.performedById });
    }
    if (input.lowStockThreshold !== undefined) {
      row = await tx.inventory.update({ where: { id: row.id }, data: { lowStockThreshold: input.lowStockThreshold } });
    }
    return row;
  });
}

export async function listInventory(params: { page: number; limit: number; q?: string; lowStock?: boolean }) {
  const { skip, take, page, limit } = getPagination(params.page, params.limit, 100);
  const search = params.q?.trim();
  const where = {
    variant: {
      deletedAt: null,
      product: { deletedAt: null },
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
              { product: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
  };

  if (params.lowStock) {
    // Column-to-column comparison is not expressible in Prisma filters, so select ids with SQL first.
    const low = await prisma.$queryRaw<{ id: string }[]>`
      SELECT i."id" FROM "inventory" i
      JOIN "product_variants" v ON v."id" = i."variantId" AND v."deletedAt" IS NULL
      JOIN "products" p ON p."id" = v."productId" AND p."deletedAt" IS NULL
      WHERE i."availableStock" <= i."lowStockThreshold"`;
    Object.assign(where, { id: { in: low.map((r) => r.id) } });
  }

  const [items, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip,
      take,
      orderBy: [{ availableStock: 'asc' }],
      include: { variant: { select: { id: true, sku: true, name: true, product: { select: { id: true, name: true, slug: true, sku: true } } } } },
    }),
    prisma.inventory.count({ where }),
  ]);
  return {
    items: items.map((i) => ({ ...i, isLowStock: i.availableStock <= i.lowStockThreshold })),
    meta: buildMeta(page, limit, total),
  };
}

export async function lowStockCount(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "inventory" i
    JOIN "product_variants" v ON v."id" = i."variantId" AND v."deletedAt" IS NULL AND v."isActive" = true
    JOIN "products" p ON p."id" = v."productId" AND p."deletedAt" IS NULL
    WHERE i."availableStock" <= i."lowStockThreshold"`;
  return Number(rows[0]?.count ?? 0);
}

export async function stockHistory(variantId: string, page = 1, limit = 30) {
  const inv = await prisma.inventory.findUnique({ where: { variantId } });
  if (!inv) throw AppError.notFound('Inventory record not found', 'INVENTORY_NOT_FOUND');
  const { skip, take } = getPagination(page, limit, 100);
  const [items, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: { inventoryId: inv.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { performedBy: { select: { name: true, email: true } }, order: { select: { orderNumber: true } } },
    }),
    prisma.inventoryTransaction.count({ where: { inventoryId: inv.id } }),
  ]);
  return { inventory: inv, items, meta: buildMeta(page, limit, total) };
}
