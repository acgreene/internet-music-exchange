ALTER TABLE "releases" ADD COLUMN "genres" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "side_starts" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "releases_genres_idx" ON "releases" USING gin ("genres");--> statement-breakpoint
CREATE INDEX "releases_tags_idx" ON "releases" USING gin ("tags");--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_genres_at_most_three" CHECK (cardinality("releases"."genres") <= 3);--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_tags_at_most_ten" CHECK (cardinality("releases"."tags") <= 10);--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_side_starts_at_most_25" CHECK (cardinality("releases"."side_starts") <= 25);