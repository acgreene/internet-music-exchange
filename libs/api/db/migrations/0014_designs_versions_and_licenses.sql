CREATE TYPE "public"."design_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."design_surface" AS ENUM('release');--> statement-breakpoint
CREATE TYPE "public"."design_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."design_license_source" AS ENUM('purchase', 'free', 'grant');--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid,
	"designer_user_id" uuid,
	"stripe_account_id" text NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"default_currency" "currency",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_accounts_artist_id_unique" UNIQUE("artist_id"),
	CONSTRAINT "payout_accounts_designer_user_id_unique" UNIQUE("designer_user_id"),
	CONSTRAINT "payout_accounts_stripe_account_id_unique" UNIQUE("stripe_account_id"),
	CONSTRAINT "payout_accounts_one_owner" CHECK (num_nonnulls("payout_accounts"."artist_id", "payout_accounts"."designer_user_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "payout_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"designer_user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"surface" "design_surface" NOT NULL,
	"status" "design_status" DEFAULT 'draft' NOT NULL,
	"visibility" "design_visibility" DEFAULT 'public' NOT NULL,
	"pricing_mode" "pricing_mode" DEFAULT 'free' NOT NULL,
	"currency" "currency",
	"minimum_price" integer DEFAULT 0 NOT NULL,
	"suggested_price" integer,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "designs_published_at_required_when_published" CHECK ("designs"."status" <> 'published' OR "designs"."published_at" IS NOT NULL),
	CONSTRAINT "designs_minimum_not_negative" CHECK ("designs"."minimum_price" >= 0),
	CONSTRAINT "designs_currency_required_when_paid" CHECK ("designs"."pricing_mode" = 'free' OR "designs"."currency" IS NOT NULL),
	CONSTRAINT "designs_free_is_zero" CHECK ("designs"."pricing_mode" <> 'free' OR ("designs"."minimum_price" = 0 AND "designs"."suggested_price" IS NULL)),
	CONSTRAINT "designs_fixed_has_price" CHECK ("designs"."pricing_mode" <> 'fixed' OR ("designs"."minimum_price" > 0 AND "designs"."suggested_price" IS NULL)),
	CONSTRAINT "designs_suggested_gte_minimum" CHECK ("designs"."suggested_price" IS NULL OR "designs"."suggested_price" >= "designs"."minimum_price")
);
--> statement-breakpoint
ALTER TABLE "designs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "design_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_versions_design_id_version_unique" UNIQUE("design_id","version"),
	CONSTRAINT "design_versions_bucket_object_key_unique" UNIQUE("bucket","object_key"),
	CONSTRAINT "design_versions_version_positive" CHECK ("design_versions"."version" >= 1),
	CONSTRAINT "design_versions_byte_size_positive" CHECK ("design_versions"."byte_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "design_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "design_licenses" (
	"design_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"source" "design_license_source" NOT NULL,
	"acquired_by_user_id" uuid,
	"amount" integer,
	"currency" "currency",
	"stripe_payment_intent_id" text,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_licenses_design_id_artist_id_pk" PRIMARY KEY("design_id","artist_id"),
	CONSTRAINT "design_licenses_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "design_licenses_payment_matches_source" CHECK (CASE WHEN "design_licenses"."source" = 'purchase'
        THEN "design_licenses"."amount" > 0 AND "design_licenses"."currency" IS NOT NULL AND "design_licenses"."stripe_payment_intent_id" IS NOT NULL
        ELSE "design_licenses"."amount" IS NULL AND "design_licenses"."currency" IS NULL AND "design_licenses"."stripe_payment_intent_id" IS NULL AND "design_licenses"."refunded_at" IS NULL
      END)
);
--> statement-breakpoint
ALTER TABLE "design_licenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "release_designs" (
	"release_id" uuid PRIMARY KEY NOT NULL,
	"design_version_id" uuid NOT NULL,
	"customization" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release_designs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "release_design_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_design_images_bucket_object_key_unique" UNIQUE("bucket","object_key"),
	CONSTRAINT "release_design_images_byte_size_positive" CHECK ("release_design_images"."byte_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "release_design_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "Managers can read their payout account" ON "artist_payout_accounts" CASCADE;--> statement-breakpoint
DROP TABLE "artist_payout_accounts" CASCADE;--> statement-breakpoint
DROP POLICY "artists can read their own designs" ON "artist_pages" CASCADE;--> statement-breakpoint
DROP TABLE "artist_pages" CASCADE;--> statement-breakpoint
DROP POLICY "Catalog is publicly readable" ON "release_artist_pages" CASCADE;--> statement-breakpoint
DROP POLICY "Managers can write release designs" ON "release_artist_pages" CASCADE;--> statement-breakpoint
DROP TABLE "release_artist_pages" CASCADE;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_designer_user_id_users_id_fk" FOREIGN KEY ("designer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_designer_user_id_users_id_fk" FOREIGN KEY ("designer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_licenses" ADD CONSTRAINT "design_licenses_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_licenses" ADD CONSTRAINT "design_licenses_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_licenses" ADD CONSTRAINT "design_licenses_acquired_by_user_id_users_id_fk" FOREIGN KEY ("acquired_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_designs" ADD CONSTRAINT "release_designs_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_designs" ADD CONSTRAINT "release_designs_design_version_id_design_versions_id_fk" FOREIGN KEY ("design_version_id") REFERENCES "public"."design_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_design_images" ADD CONSTRAINT "release_design_images_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "designs_marketplace_idx" ON "designs" USING btree ("surface","status","visibility");--> statement-breakpoint
CREATE INDEX "designs_designer_user_id_idx" ON "designs" USING btree ("designer_user_id");--> statement-breakpoint
CREATE INDEX "design_licenses_artist_id_idx" ON "design_licenses" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "release_designs_design_version_id_idx" ON "release_designs" USING btree ("design_version_id");--> statement-breakpoint
CREATE INDEX "release_design_images_release_id_idx" ON "release_design_images" USING btree ("release_id");--> statement-breakpoint
CREATE POLICY "Sellers can read their payout account" ON "payout_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "payout_accounts"."designer_user_id" OR public.is_artist_manager("payout_accounts"."artist_id"));--> statement-breakpoint
CREATE POLICY "Marketplace is publicly readable" ON "designs" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("designs"."status" = 'published' AND "designs"."visibility" = 'public');--> statement-breakpoint
CREATE POLICY "Designers can read their own designs" ON "designs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "designs"."designer_user_id");--> statement-breakpoint
CREATE POLICY "Marketplace is publicly readable" ON "design_versions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.designs d WHERE d.id = "design_versions"."design_id" AND d.status = 'published' AND d.visibility = 'public'));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "release_designs" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = "release_designs"."release_id" AND r.status = 'published'));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "release_design_images" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = "release_design_images"."release_id" AND r.status = 'published'));--> statement-breakpoint
DROP TYPE "public"."artist_page_kind";--> statement-breakpoint
DROP TYPE "public"."artist_page_status";