CREATE TABLE "chart_entries" (
	"week_start" date NOT NULL,
	"scope" text NOT NULL,
	"release_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"people" integer NOT NULL,
	CONSTRAINT "chart_entries_week_start_scope_release_id_pk" PRIMARY KEY("week_start","scope","release_id"),
	CONSTRAINT "chart_entries_position_positive" CHECK ("chart_entries"."position" >= 1),
	CONSTRAINT "chart_entries_people_positive" CHECK ("chart_entries"."people" >= 1)
);
--> statement-breakpoint
ALTER TABLE "chart_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chart_entries_scope_release_id_idx" ON "chart_entries" USING btree ("scope","release_id");