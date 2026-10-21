CREATE TYPE "public"."contribution_source" AS ENUM('donation_page', 'top_up');--> statement-breakpoint
CREATE TYPE "public"."giving_cadence" AS ENUM('one_time', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."giving_destination" AS ENUM('platform', 'developers');--> statement-breakpoint
CREATE TYPE "public"."auto_top_up_mode" AS ENUM('off', 'monthly', 'below_threshold');--> statement-breakpoint
CREATE TYPE "public"."billing_period_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."platform_cost_category" AS ENUM('storage_and_delivery', 'hosting', 'database', 'other_services', 'ownership_guarantee');--> statement-breakpoint
CREATE TYPE "public"."balance_entry_kind" AS ENUM('top_up', 'monthly_charge', 'credit', 'withdrawal', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."reserve_entry_kind" AS ENUM('donation', 'surplus', 'covered_costs', 'credited_to_sellers');--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"destination" "giving_destination" NOT NULL,
	"cadence" "giving_cadence" NOT NULL,
	"source" "contribution_source" NOT NULL,
	"amount" integer NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributions_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "contributions_amount_positive" CHECK ("contributions"."amount" > 0),
	CONSTRAINT "contributions_subscription_when_monthly" CHECK (("contributions"."cadence" = 'monthly') = ("contributions"."stripe_subscription_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "contributions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "seller_billing" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_payment_method_id" text,
	"alert_threshold_amount" integer,
	"alert_threshold_percent" integer,
	"auto_top_up_mode" "auto_top_up_mode" DEFAULT 'off' NOT NULL,
	"auto_top_up_amount" integer,
	"auto_top_up_extra_amount" integer DEFAULT 0 NOT NULL,
	"auto_top_up_extra_destination" "giving_destination",
	"lapsed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_billing_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "seller_billing_one_alert_threshold" CHECK ("seller_billing"."alert_threshold_amount" IS NULL OR "seller_billing"."alert_threshold_percent" IS NULL),
	CONSTRAINT "seller_billing_alert_threshold_amount_positive" CHECK ("seller_billing"."alert_threshold_amount" IS NULL OR "seller_billing"."alert_threshold_amount" > 0),
	CONSTRAINT "seller_billing_alert_threshold_percent_range" CHECK ("seller_billing"."alert_threshold_percent" IS NULL OR "seller_billing"."alert_threshold_percent" BETWEEN 1 AND 100),
	CONSTRAINT "seller_billing_auto_top_up_ready" CHECK ("seller_billing"."auto_top_up_mode" = 'off' OR ("seller_billing"."auto_top_up_amount" > 0 AND "seller_billing"."stripe_payment_method_id" IS NOT NULL)),
	CONSTRAINT "seller_billing_below_threshold_has_threshold" CHECK ("seller_billing"."auto_top_up_mode" <> 'below_threshold' OR "seller_billing"."alert_threshold_amount" IS NOT NULL OR "seller_billing"."alert_threshold_percent" IS NOT NULL),
	CONSTRAINT "seller_billing_extra_has_destination" CHECK ("seller_billing"."auto_top_up_extra_amount" >= 0 AND ("seller_billing"."auto_top_up_extra_amount" = 0 OR "seller_billing"."auto_top_up_extra_destination" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "seller_billing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_periods" (
	"month" date PRIMARY KEY NOT NULL,
	"storage_microdollars_per_gb_month" integer NOT NULL,
	"request_microdollars_per_million" integer NOT NULL,
	"status" "billing_period_status" DEFAULT 'open' NOT NULL,
	"seller_count" integer,
	"shared_costs_total" integer,
	"subsidy_total" integer,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_periods_month_is_first_day" CHECK (extract(day from "billing_periods"."month") = 1),
	CONSTRAINT "billing_periods_rates_not_negative" CHECK ("billing_periods"."storage_microdollars_per_gb_month" >= 0 AND "billing_periods"."request_microdollars_per_million" >= 0),
	CONSTRAINT "billing_periods_totals_when_closed" CHECK (CASE WHEN "billing_periods"."status" = 'closed'
        THEN "billing_periods"."closed_at" IS NOT NULL AND "billing_periods"."seller_count" >= 0 AND "billing_periods"."shared_costs_total" >= 0 AND "billing_periods"."subsidy_total" >= 0
        ELSE "billing_periods"."closed_at" IS NULL
      END)
);
--> statement-breakpoint
ALTER TABLE "billing_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"category" "platform_cost_category" NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_costs_amount_positive" CHECK ("platform_costs"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "platform_costs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"month" date NOT NULL,
	"usage_amount" integer NOT NULL,
	"shared_amount" integer NOT NULL,
	"subsidy_amount" integer NOT NULL,
	"card_fees_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statements_user_id_month_unique" UNIQUE("user_id","month"),
	CONSTRAINT "statements_amounts_not_negative" CHECK ("statements"."usage_amount" >= 0 AND "statements"."shared_amount" >= 0 AND "statements"."subsidy_amount" >= 0 AND "statements"."card_fees_amount" >= 0),
	CONSTRAINT "statements_subsidy_within_shared" CHECK ("statements"."subsidy_amount" <= "statements"."shared_amount"),
	CONSTRAINT "statements_total_adds_up" CHECK ("statements"."total_amount" = "statements"."usage_amount" + "statements"."shared_amount" - "statements"."subsidy_amount" + "statements"."card_fees_amount")
);
--> statement-breakpoint
ALTER TABLE "statements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "balance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" "balance_entry_kind" NOT NULL,
	"amount" integer NOT NULL,
	"card_fee" integer,
	"stripe_payment_intent_id" text,
	"stripe_refund_id" text,
	"statement_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_entries_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "balance_entries_stripe_refund_id_unique" UNIQUE("stripe_refund_id"),
	CONSTRAINT "balance_entries_statement_id_unique" UNIQUE("statement_id"),
	CONSTRAINT "balance_entries_kind_rules" CHECK (CASE "balance_entries"."kind"
        WHEN 'top_up' THEN "balance_entries"."amount" > 0 AND "balance_entries"."stripe_payment_intent_id" IS NOT NULL AND "balance_entries"."card_fee" >= 0
        WHEN 'monthly_charge' THEN "balance_entries"."amount" <= 0 AND "balance_entries"."statement_id" IS NOT NULL
        WHEN 'credit' THEN "balance_entries"."amount" > 0
        WHEN 'withdrawal' THEN "balance_entries"."amount" < 0 AND "balance_entries"."stripe_refund_id" IS NOT NULL
        ELSE "balance_entries"."note" IS NOT NULL
      END),
	CONSTRAINT "balance_entries_card_fee_only_on_top_up" CHECK ("balance_entries"."kind" = 'top_up' OR "balance_entries"."card_fee" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "balance_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cost_share_offers" (
	"artist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"share_basis_points" integer NOT NULL,
	"offered_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_share_offers_artist_id_user_id_pk" PRIMARY KEY("artist_id","user_id"),
	CONSTRAINT "cost_share_offers_basis_points_range" CHECK ("cost_share_offers"."share_basis_points" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
ALTER TABLE "cost_share_offers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cost_shares" (
	"artist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"share_basis_points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_shares_artist_id_user_id_pk" PRIMARY KEY("artist_id","user_id"),
	CONSTRAINT "cost_shares_basis_points_range" CHECK ("cost_shares"."share_basis_points" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
ALTER TABLE "cost_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "monthly_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"artist_id" uuid,
	"designer_user_id" uuid,
	"storage_byte_days" bigint DEFAULT 0 NOT NULL,
	"requests" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_usage_month_owner_unique" UNIQUE NULLS NOT DISTINCT("month","artist_id","designer_user_id"),
	CONSTRAINT "monthly_usage_one_owner" CHECK (num_nonnulls("monthly_usage"."artist_id", "monthly_usage"."designer_user_id") = 1),
	CONSTRAINT "monthly_usage_month_is_first_day" CHECK (extract(day from "monthly_usage"."month") = 1),
	CONSTRAINT "monthly_usage_not_negative" CHECK ("monthly_usage"."storage_byte_days" >= 0 AND "monthly_usage"."requests" >= 0)
);
--> statement-breakpoint
ALTER TABLE "monthly_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reserve_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "reserve_entry_kind" NOT NULL,
	"amount" integer NOT NULL,
	"month" date,
	"contribution_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reserve_entries_contribution_id_unique" UNIQUE("contribution_id"),
	CONSTRAINT "reserve_entries_kind_rules" CHECK (CASE "reserve_entries"."kind"
        WHEN 'donation' THEN "reserve_entries"."amount" > 0 AND "reserve_entries"."contribution_id" IS NOT NULL
        WHEN 'surplus' THEN "reserve_entries"."amount" > 0 AND "reserve_entries"."month" IS NOT NULL
        ELSE "reserve_entries"."amount" < 0 AND "reserve_entries"."month" IS NOT NULL
      END)
);
--> statement-breakpoint
ALTER TABLE "reserve_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "off_sale_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "byte_size" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "off_sale_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_billing" ADD CONSTRAINT "seller_billing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_costs" ADD CONSTRAINT "platform_costs_month_billing_periods_month_fk" FOREIGN KEY ("month") REFERENCES "public"."billing_periods"("month") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_month_billing_periods_month_fk" FOREIGN KEY ("month") REFERENCES "public"."billing_periods"("month") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_entries" ADD CONSTRAINT "balance_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_entries" ADD CONSTRAINT "balance_entries_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_share_offers" ADD CONSTRAINT "cost_share_offers_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_share_offers" ADD CONSTRAINT "cost_share_offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_share_offers" ADD CONSTRAINT "cost_share_offers_offered_by_user_id_users_id_fk" FOREIGN KEY ("offered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_shares" ADD CONSTRAINT "cost_shares_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_shares" ADD CONSTRAINT "cost_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_usage" ADD CONSTRAINT "monthly_usage_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_usage" ADD CONSTRAINT "monthly_usage_designer_user_id_users_id_fk" FOREIGN KEY ("designer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserve_entries" ADD CONSTRAINT "reserve_entries_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributions_destination_created_at_idx" ON "contributions" USING btree ("destination","created_at");--> statement-breakpoint
CREATE INDEX "platform_costs_month_idx" ON "platform_costs" USING btree ("month");--> statement-breakpoint
CREATE INDEX "balance_entries_user_id_created_at_idx" ON "balance_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "cost_share_offers_user_id_idx" ON "cost_share_offers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cost_shares_user_id_idx" ON "cost_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reserve_entries_month_idx" ON "reserve_entries" USING btree ("month");