-- Custom SQL migration file, put your code below! --
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
