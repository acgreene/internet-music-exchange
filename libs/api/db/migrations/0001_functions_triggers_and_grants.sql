-- Custom SQL migration file, put your code below! --

-- Drizzle has no API for functions or triggers, so everything below is written
-- by hand. See https://github.com/drizzle-team/drizzle-orm/issues/843.

-- apply grants to all tables in the public schema for the postgres role
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;--> statement-breakpoint

/**
 * `id` and `created_at` are owned by the auth trigger below, so users may edit
 * only their own profile fields. Column-level grants are the only way to say
 * this: RLS policies gate rows, never columns.
 */
REVOKE UPDATE ON public.users FROM anon, authenticated;--> statement-breakpoint
GRANT UPDATE (username, name) ON public.users TO authenticated;--> statement-breakpoint

/**
 * Copies each new Supabase auth user into `public.users`.
 *
 * Email is deliberately not copied. `auth.users` is the source of truth for it,
 * and this trigger fires on insert alone, so any copy would go stale the moment
 * a user changed their address.
 */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	INSERT INTO public.users (id, name)
	VALUES (
		NEW.id,
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
	EXECUTE FUNCTION public.handle_new_artist();--> statement-breakpoint

/**
 * Stamps `updated_at` on every edit to a release comment. Running BEFORE the
 * write also means a client cannot forge the value.
 */
CREATE OR REPLACE FUNCTION public.set_release_comment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	NEW.updated_at = now();

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER set_release_comment_updated_at
	BEFORE UPDATE ON public.release_comments
	FOR EACH ROW
	EXECUTE FUNCTION public.set_release_comment_updated_at();
