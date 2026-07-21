-- Custom SQL migration file, put your code below! --

-- Clear shipping-address PII when a buyer deletes their account. Deletion
-- cascades to null orders.user_id (the FK's ON DELETE SET NULL); this BEFORE
-- UPDATE trigger catches that transition and drops the address with it, so no
-- shipping PII outlives the account.
CREATE OR REPLACE FUNCTION public.purge_order_pii_on_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL THEN
		NEW.shipping_address = NULL;
END IF;

RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER purge_order_pii_on_user_delete
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_order_pii_on_user_delete();
