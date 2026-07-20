CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'completed', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."entitlement_source" AS ENUM('purchase', 'free', 'gift');--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"release_id" uuid NOT NULL,
	"status" "purchase_status" DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "purchases_amount_positive" CHECK ("purchases"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "entitlements" (
	"user_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"source" "entitlement_source" NOT NULL,
	"purchase_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlements_user_id_release_id_pk" PRIMARY KEY("user_id","release_id")
);
--> statement-breakpoint
ALTER TABLE "entitlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchases_user_id_idx" ON "purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchases_release_id_idx" ON "purchases" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "entitlements_release_id_idx" ON "entitlements" USING btree ("release_id");--> statement-breakpoint
CREATE POLICY "Buyers can read their own purchases" ON "purchases" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "purchases"."user_id");--> statement-breakpoint
CREATE POLICY "Managers can read sales of their releases" ON "purchases" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "purchases"."release_id")));--> statement-breakpoint
CREATE POLICY "Users can read their own library" ON "entitlements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "entitlements"."user_id");