CREATE TABLE "artist_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"stripe_account_id" text NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_payout_accounts_artist_id_unique" UNIQUE("artist_id"),
	CONSTRAINT "artist_payout_accounts_stripe_account_id_unique" UNIQUE("stripe_account_id")
);
--> statement-breakpoint
ALTER TABLE "artist_payout_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artist_payout_accounts" ADD CONSTRAINT "artist_payout_accounts_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "Managers can read their payout account" ON "artist_payout_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_artist_manager("artist_payout_accounts"."artist_id"));