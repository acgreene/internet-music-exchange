-- Mirror every new Supabase auth user into `public.users`.
--
-- This runs inside the user signup flow, so any errors here will fail the signup.
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
	-- A retried or replayed signup must not 500. `username` is left null and
	-- is expected to be set during onboarding.
	ON CONFLICT (id) DO NOTHING;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
	AFTER INSERT ON auth.users
	FOR EACH ROW
	EXECUTE FUNCTION public.handle_new_user();
