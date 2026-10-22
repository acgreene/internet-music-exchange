CREATE TABLE "commission_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"designer_user_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"design_id" uuid,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_requests_message_length" CHECK (length("commission_requests"."message") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "commission_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "open_to_commissions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_designer_user_id_users_id_fk" FOREIGN KEY ("designer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_requests" ADD CONSTRAINT "commission_requests_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_requests_requester_idx" ON "commission_requests" USING btree ("requester_user_id","created_at");