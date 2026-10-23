DROP INDEX "chart_entries_scope_release_id_idx";--> statement-breakpoint
ALTER TABLE "chart_entries" DROP CONSTRAINT "chart_entries_week_start_scope_release_id_pk";--> statement-breakpoint
ALTER TABLE "chart_entries" ADD COLUMN "chart" text NOT NULL;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_chart_week_start_scope_release_id_pk" PRIMARY KEY("chart","week_start","scope","release_id");--> statement-breakpoint
CREATE INDEX "chart_entries_chart_scope_release_id_idx" ON "chart_entries" USING btree ("chart","scope","release_id");--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_chart_known" CHECK ("chart_entries"."chart" IN ('selling', 'downloads'));