CREATE TYPE "public"."crate_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TABLE "crates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"visibility" "crate_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crates_name_length" CHECK (length("crates"."name") BETWEEN 1 AND 80),
	CONSTRAINT "crates_note_length" CHECK ("crates"."note" IS NULL OR length("crates"."note") BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "crates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "crate_releases" (
	"crate_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"note" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crate_releases_crate_id_release_id_pk" PRIMARY KEY("crate_id","release_id"),
	CONSTRAINT "crate_releases_crate_id_position_unique" UNIQUE("crate_id","position"),
	CONSTRAINT "crate_releases_position_positive" CHECK ("crate_releases"."position" >= 1),
	CONSTRAINT "crate_releases_note_length" CHECK ("crate_releases"."note" IS NULL OR length("crate_releases"."note") BETWEEN 1 AND 280)
);
--> statement-breakpoint
ALTER TABLE "crate_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_followers" (
	"follower_user_id" uuid NOT NULL,
	"followed_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_followers_follower_user_id_followed_user_id_pk" PRIMARY KEY("follower_user_id","followed_user_id"),
	CONSTRAINT "user_followers_not_self" CHECK ("user_followers"."follower_user_id" <> "user_followers"."followed_user_id")
);
--> statement-breakpoint
ALTER TABLE "user_followers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "crates" ADD CONSTRAINT "crates_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crate_releases" ADD CONSTRAINT "crate_releases_crate_id_crates_id_fk" FOREIGN KEY ("crate_id") REFERENCES "public"."crates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crate_releases" ADD CONSTRAINT "crate_releases_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_followers" ADD CONSTRAINT "user_followers_follower_user_id_users_id_fk" FOREIGN KEY ("follower_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_followers" ADD CONSTRAINT "user_followers_followed_user_id_users_id_fk" FOREIGN KEY ("followed_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crates_owner_user_id_idx" ON "crates" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "crates_visibility_updated_at_idx" ON "crates" USING btree ("visibility","updated_at");--> statement-breakpoint
CREATE INDEX "crate_releases_release_id_idx" ON "crate_releases" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "user_followers_followed_user_id_idx" ON "user_followers" USING btree ("followed_user_id");