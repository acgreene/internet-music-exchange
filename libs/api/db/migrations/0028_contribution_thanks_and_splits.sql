ALTER TABLE "contributions" DROP CONSTRAINT "contributions_stripe_payment_intent_id_unique";--> statement-breakpoint
ALTER TABLE "contributions" ADD COLUMN "thanks_name" text;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_payment_destination_unique" UNIQUE("stripe_payment_intent_id","destination");--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_thanks_name_max_length" CHECK (length("contributions"."thanks_name") <= 60);