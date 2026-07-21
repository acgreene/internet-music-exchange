CREATE TYPE "public"."shipping_zone" AS ENUM('domestic', 'international');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_status" AS ENUM('unfulfilled', 'shipped', 'delivered');--> statement-breakpoint
CREATE TABLE "product_shipping_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"destination" "shipping_zone" NOT NULL,
	"first_item_amount" integer NOT NULL,
	"additional_item_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_shipping_rates_product_id_destination_unique" UNIQUE("product_id","destination"),
	CONSTRAINT "product_shipping_rates_first_not_negative" CHECK ("product_shipping_rates"."first_item_amount" >= 0),
	CONSTRAINT "product_shipping_rates_additional_not_negative" CHECK ("product_shipping_rates"."additional_item_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_shipping_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fulfillments" (
	"artist_order_id" uuid PRIMARY KEY NOT NULL,
	"status" "fulfillment_status" DEFAULT 'unfulfilled' NOT NULL,
	"tracking_number" text,
	"carrier" text,
	"shipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillments_shipped_has_date" CHECK ("fulfillments"."status" = 'unfulfilled' OR "fulfillments"."shipped_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "fulfillments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "artist_orders" ADD COLUMN "shipping_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_orders" ADD COLUMN "tax_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_shipping_rates" ADD CONSTRAINT "product_shipping_rates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_artist_order_id_artist_orders_id_fk" FOREIGN KEY ("artist_order_id") REFERENCES "public"."artist_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_orders" ADD CONSTRAINT "artist_orders_shipping_not_negative" CHECK ("artist_orders"."shipping_amount" >= 0);--> statement-breakpoint
ALTER TABLE "artist_orders" ADD CONSTRAINT "artist_orders_tax_not_negative" CHECK ("artist_orders"."tax_amount" >= 0);--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "product_shipping_rates" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = "product_shipping_rates"."product_id" AND p.status = 'published'));--> statement-breakpoint
CREATE POLICY "Managers can write shipping rates" ON "product_shipping_rates" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = "product_shipping_rates"."product_id"))) WITH CHECK (public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = "product_shipping_rates"."product_id")));--> statement-breakpoint
CREATE POLICY "Buyers can read their own fulfillments" ON "fulfillments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.artist_orders ao JOIN public.orders o ON o.id = ao.order_id WHERE ao.id = "fulfillments"."artist_order_id" AND o.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "Managers can manage their fulfillments" ON "fulfillments" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager((SELECT ao.artist_id FROM public.artist_orders ao WHERE ao.id = "fulfillments"."artist_order_id"))) WITH CHECK (public.is_artist_manager((SELECT ao.artist_id FROM public.artist_orders ao WHERE ao.id = "fulfillments"."artist_order_id")));