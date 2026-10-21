CREATE TYPE "public"."artist_image_kind" AS ENUM('avatar', 'header');--> statement-breakpoint
CREATE TABLE "artist_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"kind" "artist_image_kind" NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_images_artist_id_kind_unique" UNIQUE("artist_id","kind"),
	CONSTRAINT "artist_images_bucket_object_key_unique" UNIQUE("bucket","object_key"),
	CONSTRAINT "artist_images_byte_size_positive" CHECK ("artist_images"."byte_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "artist_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artist_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_links_label_length" CHECK (length("artist_links"."label") BETWEEN 1 AND 50),
	CONSTRAINT "artist_links_url_https" CHECK ("artist_links"."url" ~ '^https://' AND length("artist_links"."url") <= 2048),
	CONSTRAINT "artist_links_position_not_negative" CHECK ("artist_links"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "artist_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "handle" text NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_images" ADD CONSTRAINT "artist_images_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_links" ADD CONSTRAINT "artist_links_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_links_artist_id_idx" ON "artist_links" USING btree ("artist_id");--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_handle_unique" UNIQUE("handle");--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_artist_id_slug_unique" UNIQUE("artist_id","slug");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_format" CHECK ("users"."username" ~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$');--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_handle_format" CHECK ("artists"."handle" ~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$');--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_slug_format" CHECK ("releases"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("releases"."slug") <= 100);--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "artist_images" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "artist_links" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);