CREATE TYPE "public"."currency" AS ENUM('usd', 'eur');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('free', 'fixed', 'name_your_price');--> statement-breakpoint
CREATE TABLE "release_pricing" (
	"release_id" uuid PRIMARY KEY NOT NULL,
	"mode" "pricing_mode" NOT NULL,
	"currency" "currency",
	"minimum_price" integer DEFAULT 0 NOT NULL,
	"suggested_price" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_pricing_minimum_not_negative" CHECK ("release_pricing"."minimum_price" >= 0),
	CONSTRAINT "release_pricing_currency_required_when_paid" CHECK ("release_pricing"."mode" = 'free' OR "release_pricing"."currency" IS NOT NULL),
	CONSTRAINT "release_pricing_free_is_zero" CHECK ("release_pricing"."mode" <> 'free' OR ("release_pricing"."minimum_price" = 0 AND "release_pricing"."suggested_price" IS NULL)),
	CONSTRAINT "release_pricing_fixed_has_price" CHECK ("release_pricing"."mode" <> 'fixed' OR ("release_pricing"."minimum_price" > 0 AND "release_pricing"."suggested_price" IS NULL)),
	CONSTRAINT "release_pricing_suggested_gte_minimum" CHECK ("release_pricing"."suggested_price" IS NULL OR "release_pricing"."suggested_price" >= "release_pricing"."minimum_price")
);
--> statement-breakpoint
ALTER TABLE "release_pricing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artist_payout_accounts" ADD COLUMN "default_currency" "currency";--> statement-breakpoint
ALTER TABLE "release_pricing" ADD CONSTRAINT "release_pricing_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "release_pricing" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = "release_pricing"."release_id" AND r.status = 'published'));--> statement-breakpoint
CREATE POLICY "Managers can write pricing" ON "release_pricing" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_pricing"."release_id"))) WITH CHECK (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_pricing"."release_id")));