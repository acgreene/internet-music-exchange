CREATE TYPE "public"."release_kind" AS ENUM('single', 'ep', 'lp', 'album', 'compilation', 'remaster', 'soundtrack', 'score', 'demo', 'other');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artist_managers" (
	"user_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_managers_user_id_artist_id_pk" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
ALTER TABLE "artist_managers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist_id" uuid NOT NULL,
	"released_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "release_kind" NOT NULL,
	"status" "release_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "releases_published_at_required_when_published" CHECK ("releases"."status" <> 'published' OR "releases"."published_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "release_tracks" (
	"release_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"is_preview" boolean DEFAULT false NOT NULL,
	CONSTRAINT "release_tracks_release_id_track_id_pk" PRIMARY KEY("release_id","track_id"),
	CONSTRAINT "release_tracks_release_id_position_unique" UNIQUE("release_id","position"),
	CONSTRAINT "release_tracks_position_positive" CHECK ("release_tracks"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "release_tracks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "artist_followers" (
	"user_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_followers_user_id_artist_id_pk" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
ALTER TABLE "artist_followers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "release_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_comments_comment_not_empty" CHECK (length(trim("release_comments"."comment")) > 0),
	CONSTRAINT "release_comments_comment_max_length" CHECK (length("release_comments"."comment") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "release_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_managers" ADD CONSTRAINT "artist_managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_managers" ADD CONSTRAINT "artist_managers_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tracks" ADD CONSTRAINT "release_tracks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tracks" ADD CONSTRAINT "release_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_followers" ADD CONSTRAINT "artist_followers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_followers" ADD CONSTRAINT "artist_followers_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_managers_artist_id_idx" ON "artist_managers" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "tracks_artist_id_idx" ON "tracks" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "releases_artist_id_idx" ON "releases" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "releases_status_idx" ON "releases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "release_tracks_track_id_idx" ON "release_tracks" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "artist_followers_artist_id_idx" ON "artist_followers" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "release_comments_release_id_created_at_idx" ON "release_comments" USING btree ("release_id","created_at");--> statement-breakpoint
CREATE INDEX "release_comments_user_id_idx" ON "release_comments" USING btree ("user_id");--> statement-breakpoint

/**
 * Whether the current user manages the given artist.
 *
 * SECURITY DEFINER so policies can call it without re-entering the
 * `artist_managers` policies, which would recurse.
 *
 * Hand-written above the policies below because Drizzle has no function API,
 * and a `LANGUAGE sql` body is validated at creation time: it has to come
 * after `artist_managers` exists but before any policy calls it.
 */
CREATE OR REPLACE FUNCTION public.is_artist_manager(artist uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.artist_managers am
		WHERE am.artist_id = artist
		  AND am.user_id = (SELECT auth.uid())
	);
$$;--> statement-breakpoint

CREATE POLICY "User profiles are publicly readable" ON "users" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can update their own row" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "users"."id") WITH CHECK ((select auth.uid()) = "users"."id");--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "artists" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated can create artists" ON "artists" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Managers can update their artist" ON "artists" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_artist_manager("artists"."id")) WITH CHECK (public.is_artist_manager("artists"."id"));--> statement-breakpoint
CREATE POLICY "Managers can delete their artist" ON "artists" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_artist_manager("artists"."id"));--> statement-breakpoint
CREATE POLICY "Managers can read grants" ON "artist_managers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "artist_managers"."user_id" OR public.is_artist_manager("artist_managers"."artist_id"));--> statement-breakpoint
CREATE POLICY "Managers can add managers" ON "artist_managers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_artist_manager("artist_managers"."artist_id"));--> statement-breakpoint
CREATE POLICY "Managers can remove managers" ON "artist_managers" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "artist_managers"."user_id" OR public.is_artist_manager("artist_managers"."artist_id"));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "tracks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (
        SELECT 1
        FROM public.release_tracks rt
        JOIN public.releases r ON r.id = rt.release_id
        WHERE rt.track_id = "tracks"."id" AND r.status = 'published'
      ));--> statement-breakpoint
CREATE POLICY "Managers can write tracks" ON "tracks" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager("tracks"."artist_id")) WITH CHECK (public.is_artist_manager("tracks"."artist_id"));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "releases" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("releases"."status" = 'published');--> statement-breakpoint
CREATE POLICY "Managers can write releases" ON "releases" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager("releases"."artist_id")) WITH CHECK (public.is_artist_manager("releases"."artist_id"));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "release_tracks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = "release_tracks"."release_id" AND r.status = 'published'));--> statement-breakpoint
CREATE POLICY "Managers can write release tracks" ON "release_tracks" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_tracks"."release_id"))) WITH CHECK (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_tracks"."release_id")));--> statement-breakpoint
CREATE POLICY "Artist followers are publicly readable" ON "artist_followers" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can follow an artist" ON "artist_followers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "artist_followers"."user_id");--> statement-breakpoint
CREATE POLICY "Users can unfollow an artist" ON "artist_followers" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "artist_followers"."user_id");--> statement-breakpoint
CREATE POLICY "Artist managers can remove followers from the artist" ON "artist_followers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_artist_manager("artist_followers"."artist_id"));--> statement-breakpoint
CREATE POLICY "Release comments are publicly readable" ON "release_comments" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can fully manage comments they leave on a release" ON "release_comments" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "release_comments"."user_id") WITH CHECK ((select auth.uid()) = "release_comments"."user_id");--> statement-breakpoint
CREATE POLICY "Managers can remove comments on their releases" ON "release_comments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_comments"."release_id")));