CREATE TABLE "crate_saves" (
	"user_id" uuid NOT NULL,
	"crate_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crate_saves_user_id_crate_id_pk" PRIMARY KEY("user_id","crate_id")
);
--> statement-breakpoint
ALTER TABLE "crate_saves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "crate_saves" ADD CONSTRAINT "crate_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crate_saves" ADD CONSTRAINT "crate_saves_crate_id_crates_id_fk" FOREIGN KEY ("crate_id") REFERENCES "public"."crates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crate_saves_crate_id_idx" ON "crate_saves" USING btree ("crate_id");