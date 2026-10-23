ALTER TABLE "designs" ADD COLUMN "styles" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "designs_styles_idx" ON "designs" USING gin ("styles");--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_styles_at_most_three" CHECK (cardinality("designs"."styles") <= 3);