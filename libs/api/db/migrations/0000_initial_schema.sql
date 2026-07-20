CREATE TYPE "public"."release_kind" AS ENUM('single', 'ep', 'lp', 'album', 'compilation', 'remaster', 'soundtrack', 'score', 'demo', 'other');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
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
	"kind" "release_kind" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "release_tracks" (
	"release_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "release_tracks_release_id_track_id_pk" PRIMARY KEY("release_id","track_id"),
	CONSTRAINT "release_tracks_release_id_position_unique" UNIQUE("release_id","position"),
	CONSTRAINT "release_tracks_position_positive" CHECK ("release_tracks"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "release_tracks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_managers" ADD CONSTRAINT "artist_managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_managers" ADD CONSTRAINT "artist_managers_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tracks" ADD CONSTRAINT "release_tracks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tracks" ADD CONSTRAINT "release_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_managers_artist_id_idx" ON "artist_managers" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "tracks_artist_id_idx" ON "tracks" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "releases_artist_id_idx" ON "releases" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "release_tracks_track_id_idx" ON "release_tracks" USING btree ("track_id");--> statement-breakpoint

/**
 * Whether the current user manages the given artist.
 *
 * SECURITY DEFINER so policies can call it without re-entering the
 * `artist_managers` policies, which would recurse.
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

CREATE POLICY "Users can read their own row" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "users"."id");--> statement-breakpoint
CREATE POLICY "Users can update their own row" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "users"."id") WITH CHECK ((select auth.uid()) = "users"."id");--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "artists" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Authenticated can create artists" ON "artists" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Managers can update their artist" ON "artists" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_artist_manager("artists"."id")) WITH CHECK (public.is_artist_manager("artists"."id"));--> statement-breakpoint
CREATE POLICY "Managers can delete their artist" ON "artists" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_artist_manager("artists"."id"));--> statement-breakpoint
CREATE POLICY "Managers can read grants" ON "artist_managers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "artist_managers"."user_id" OR public.is_artist_manager("artist_managers"."artist_id"));--> statement-breakpoint
CREATE POLICY "Managers can add managers" ON "artist_managers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_artist_manager("artist_managers"."artist_id"));--> statement-breakpoint
CREATE POLICY "Managers can remove managers" ON "artist_managers" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "artist_managers"."user_id" OR public.is_artist_manager("artist_managers"."artist_id"));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "tracks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Managers can write tracks" ON "tracks" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager("tracks"."artist_id")) WITH CHECK (public.is_artist_manager("tracks"."artist_id"));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "releases" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Managers can write releases" ON "releases" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager("releases"."artist_id")) WITH CHECK (public.is_artist_manager("releases"."artist_id"));--> statement-breakpoint
CREATE POLICY "Catalog is publicly readable" ON "release_tracks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Managers can write release tracks" ON "release_tracks" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_tracks"."release_id"))) WITH CHECK (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_tracks"."release_id")));--> statement-breakpoint

-- apply grants to all tables in the public schema for the postgres role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;--> statement-breakpoint

/**
 * Copies each new Supabase auth user into `public.users`.
 */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	INSERT INTO public.users (id, email, name)
	VALUES (
		NEW.id,
		NEW.email,
		NEW.raw_user_meta_data ->> 'name'
	)
	ON CONFLICT (id) DO NOTHING;

	RETURN NEW;
END;
$$;--> statement-breakpoint

/** Mirrors new auth users into `public.users` on signup. */
CREATE TRIGGER on_auth_user_created
	AFTER INSERT ON auth.users
	FOR EACH ROW
	EXECUTE FUNCTION public.handle_new_user();--> statement-breakpoint

/**
 * Records whoever created an artist as its first manager.
 */
CREATE OR REPLACE FUNCTION public.handle_new_artist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF (SELECT auth.uid()) IS NULL THEN
		RETURN NEW;
	END IF;

	INSERT INTO public.artist_managers (user_id, artist_id)
	VALUES ((SELECT auth.uid()), NEW.id)
	ON CONFLICT DO NOTHING;

	RETURN NEW;
END;
$$;--> statement-breakpoint

/** Grants an artist's creator the first management role. */
CREATE TRIGGER on_artist_created
	AFTER INSERT ON public.artists
	FOR EACH ROW
	EXECUTE FUNCTION public.handle_new_artist();
