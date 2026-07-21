CREATE TYPE "public"."product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('vinyl', 'cd', 'cassette', 'shirt', 'hoodie', 'sweatshirt', 'hat', 'beanie', 'other');--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"release_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"type" "product_type" NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"currency" "currency" NOT NULL,
	"option1_name" text,
	"option2_name" text,
	"option3_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_option_names_gap_free" CHECK (("products"."option1_name" IS NOT NULL OR "products"."option2_name" IS NULL) AND ("products"."option2_name" IS NOT NULL OR "products"."option3_name" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"option1_value" text,
	"option2_value" text,
	"option3_value" text,
	"price" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"sku" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_combination_unique" UNIQUE NULLS NOT DISTINCT("product_id","option1_value","option2_value","option3_value"),
	CONSTRAINT "product_variants_price_not_negative" CHECK ("product_variants"."price" >= 0),
	CONSTRAINT "product_variants_stock_not_negative" CHECK ("product_variants"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"alt_text" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_bucket_object_key_unique" UNIQUE("bucket","object_key"),
	CONSTRAINT "product_images_position_not_negative" CHECK ("product_images"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_artist_id_idx" ON "products" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "products_release_id_idx" ON "products" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "products" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("products"."status" = 'published');--> statement-breakpoint
CREATE POLICY "Managers can write products" ON "products" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager("products"."artist_id")) WITH CHECK (public.is_artist_manager("products"."artist_id"));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "product_variants" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = "product_variants"."product_id" AND p.status = 'published'));--> statement-breakpoint
CREATE POLICY "Managers can write variants" ON "product_variants" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = "product_variants"."product_id"))) WITH CHECK (public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = "product_variants"."product_id")));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "product_images" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = "product_images"."product_id" AND p.status = 'published'));--> statement-breakpoint
CREATE POLICY "Managers can read their product images" ON "product_images" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_artist_manager((SELECT p.artist_id FROM public.products p WHERE p.id = "product_images"."product_id")));