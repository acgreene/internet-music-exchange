CREATE TYPE "public"."artist_page_kind" AS ENUM('home', 'release');--> statement-breakpoint
CREATE TYPE "public"."artist_page_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "artist_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"kind" "artist_page_kind" NOT NULL,
	"status" "artist_page_status" DEFAULT 'draft' NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_pages_bucket_object_key_unique" UNIQUE("bucket","object_key")
);
--> statement-breakpoint
ALTER TABLE "artist_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "release_artist_pages" (
	"release_id" uuid PRIMARY KEY NOT NULL,
	"artist_page_id" uuid NOT NULL,
	"customization" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "release_artist_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artist_pages" ADD CONSTRAINT "artist_pages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_artist_pages" ADD CONSTRAINT "release_artist_pages_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_artist_pages" ADD CONSTRAINT "release_artist_pages_artist_page_id_artist_pages_id_fk" FOREIGN KEY ("artist_page_id") REFERENCES "public"."artist_pages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_pages_kind_status_idx" ON "artist_pages" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "artist_pages_created_by_user_id_idx" ON "artist_pages" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "release_artist_pages_artist_page_id_idx" ON "release_artist_pages" USING btree ("artist_page_id");--> statement-breakpoint
CREATE POLICY "artists can read their own designs" ON "artist_pages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "artist_pages"."created_by_user_id");--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "release_artist_pages" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = "release_artist_pages"."release_id" AND r.status = 'published'));--> statement-breakpoint
CREATE POLICY "Managers can write release designs" ON "release_artist_pages" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_artist_pages"."release_id"))) WITH CHECK (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_artist_pages"."release_id")));