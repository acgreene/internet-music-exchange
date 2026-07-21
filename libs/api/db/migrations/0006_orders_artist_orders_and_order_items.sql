CREATE TYPE "public"."artist_order_status" AS ENUM('pending', 'completed', 'refunded', 'failed');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artist_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"status" "artist_order_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_orders_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "artist_orders_amount_positive" CHECK ("artist_orders"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "artist_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_order_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" >= 1),
	CONSTRAINT "order_items_unit_price_not_negative" CHECK ("order_items"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchases" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "Buyers can read their own purchases" ON "purchases" CASCADE;--> statement-breakpoint
DROP POLICY "Managers can read sales of their releases" ON "purchases" CASCADE;--> statement-breakpoint
DROP TABLE "purchases" CASCADE;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "order_item_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_orders" ADD CONSTRAINT "artist_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_orders" ADD CONSTRAINT "artist_orders_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_artist_order_id_artist_orders_id_fk" FOREIGN KEY ("artist_order_id") REFERENCES "public"."artist_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "artist_orders_order_id_idx" ON "artist_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "artist_orders_artist_id_idx" ON "artist_orders" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "order_items_artist_order_id_idx" ON "order_items" USING btree ("artist_order_id");--> statement-breakpoint
CREATE INDEX "order_items_release_id_idx" ON "order_items" USING btree ("release_id");--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN "purchase_id";--> statement-breakpoint
CREATE POLICY "Buyers can read their own orders" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "orders"."user_id");--> statement-breakpoint
CREATE POLICY "Buyers can read their own artist orders" ON "artist_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = "artist_orders"."order_id" AND o.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "Managers can read their artist orders" ON "artist_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_artist_manager("artist_orders"."artist_id"));--> statement-breakpoint
CREATE POLICY "Buyers can read their own order items" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.artist_orders ao JOIN public.orders o ON o.id = ao.order_id WHERE ao.id = "order_items"."artist_order_id" AND o.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "Managers can read their order items" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.artist_orders ao WHERE ao.id = "order_items"."artist_order_id" AND public.is_artist_manager(ao.artist_id)));--> statement-breakpoint
DROP TYPE "public"."purchase_status";