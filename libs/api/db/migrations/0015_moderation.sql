CREATE TYPE "public"."moderation_target" AS ENUM('release', 'product', 'comment', 'design', 'artist', 'user');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('hate_or_harassment', 'copyright', 'illegal_content', 'harmful_design_code', 'spam', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."moderation_action_kind" AS ENUM('dismiss', 'take_down', 'finalize_takedown', 'restore', 'suspend', 'unsuspend', 'clear_profile');--> statement-breakpoint
CREATE TYPE "public"."copyright_contest_outcome" AS ENUM('upheld', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."release_status" ADD VALUE 'taken_down';--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE 'taken_down';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE 'taken_down';--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid,
	"claimant_name" text,
	"claimant_email" text,
	"target_type" "moderation_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_reporter_or_claimant" CHECK ("reports"."reporter_user_id" IS NOT NULL OR ("reports"."reason" = 'copyright' AND "reports"."claimant_email" IS NOT NULL)),
	CONSTRAINT "reports_note_length" CHECK ("reports"."note" IS NULL OR length("reports"."note") <= 2000),
	CONSTRAINT "reports_resolved_when_closed" CHECK (("reports"."status" = 'open') = ("reports"."resolved_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"action" "moderation_action_kind" NOT NULL,
	"target_type" "moderation_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" "report_reason",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moderation_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "copyright_contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"contested_by_user_id" uuid,
	"statement" text NOT NULL,
	"outcome" "copyright_contest_outcome",
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copyright_contests_statement_length" CHECK (length("copyright_contests"."statement") BETWEEN 1 AND 5000),
	CONSTRAINT "copyright_contests_outcome_when_resolved" CHECK (("copyright_contests"."outcome" IS NULL) = ("copyright_contests"."resolved_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "copyright_contests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "takedown_final_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_contests" ADD CONSTRAINT "copyright_contests_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_contests" ADD CONSTRAINT "copyright_contests_contested_by_user_id_users_id_fk" FOREIGN KEY ("contested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_contests" ADD CONSTRAINT "copyright_contests_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reporter_target_unique" ON "reports" USING btree ("reporter_user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_created_at_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "copyright_contests_release_id_idx" ON "copyright_contests" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "copyright_contests_one_open_per_release" ON "copyright_contests" USING btree ("release_id") WHERE "copyright_contests"."resolved_at" IS NULL;--> statement-breakpoint
ALTER POLICY "Catalog is publicly readable" ON "artists" TO anon,authenticated USING ("artists"."suspended_at" IS NULL);