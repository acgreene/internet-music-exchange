ALTER TABLE "artists" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "country" text;--> statement-breakpoint
CREATE INDEX "artists_country_idx" ON "artists" USING btree ("country");--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_city_length" CHECK ("artists"."city" IS NULL OR length("artists"."city") BETWEEN 1 AND 80);--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_country_code" CHECK ("artists"."country" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_city_needs_country" CHECK ("artists"."city" IS NULL OR "artists"."country" IS NOT NULL);