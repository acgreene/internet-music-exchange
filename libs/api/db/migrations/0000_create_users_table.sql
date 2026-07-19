CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
-- Hand-written below. Drizzle only manages the `public` schema, so it cannot
-- generate a foreign key into `auth` or emit row-level security policies.

-- Tie each profile row to its corresponding supabase auth entity. ON DELETE CASCADE means deleting
-- a Supabase auth user removes the matching profile row.
ALTER TABLE "users" ADD CONSTRAINT "users_id_auth_users_id_fk"
	FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;
--> statement-breakpoint
-- Supabase exposes every table in `public` through PostgREST, so without RLS
-- the anon key could read this table entirely.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Users can read their own row" ON "users"
	FOR SELECT TO authenticated
	USING ((SELECT auth.uid()) = "id");
--> statement-breakpoint
CREATE POLICY "Users can update their own row" ON "users"
	FOR UPDATE TO authenticated
	USING ((SELECT auth.uid()) = "id")
	WITH CHECK ((SELECT auth.uid()) = "id");
