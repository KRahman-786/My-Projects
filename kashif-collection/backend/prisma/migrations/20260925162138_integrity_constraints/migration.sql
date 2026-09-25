-- Inventory invariants: stock can never go negative and the three counters always agree.
ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_total_non_negative" CHECK ("totalStock" >= 0),
  ADD CONSTRAINT "inventory_reserved_non_negative" CHECK ("reservedStock" >= 0),
  ADD CONSTRAINT "inventory_available_non_negative" CHECK ("availableStock" >= 0),
  ADD CONSTRAINT "inventory_counters_consistent" CHECK ("totalStock" = "reservedStock" + "availableStock");

ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive" CHECK ("price" > 0 AND "mrp" > 0 AND "price" <= "mrp");

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_value_positive" CHECK ("value" > 0),
  ADD CONSTRAINT "coupons_used_within_limit" CHECK ("usageLimit" IS NULL OR "usedCount" <= "usageLimit");
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_singleton" CHECK ("id" = 1);

-- At most one default address per user.
CREATE UNIQUE INDEX "addresses_one_default_per_user" ON "addresses" ("userId") WHERE "isDefault" = true;

-- Case-insensitive search support for product names.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
