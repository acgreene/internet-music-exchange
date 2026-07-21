ALTER TABLE "order_items" ALTER COLUMN "release_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_variant_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "includes_digital" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_product_variant_id_idx" ON "order_items" USING btree ("product_variant_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_release_xor_variant" CHECK (num_nonnulls("order_items"."release_id", "order_items"."product_variant_id") = 1);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_digital_single_quantity" CHECK ("order_items"."release_id" IS NULL OR "order_items"."quantity" = 1);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_includes_digital_needs_release" CHECK (NOT "products"."includes_digital" OR "products"."release_id" IS NOT NULL);