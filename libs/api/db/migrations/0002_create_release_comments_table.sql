CREATE TABLE "release_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_comments_comment_not_empty" CHECK (length(trim("release_comments"."comment")) > 0),
	CONSTRAINT "release_comments_comment_max_length" CHECK (length("release_comments"."comment") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "release_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_comments" ADD CONSTRAINT "release_comments_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "release_comments_release_id_created_at_idx" ON "release_comments" USING btree ("release_id","created_at");--> statement-breakpoint
CREATE INDEX "release_comments_user_id_idx" ON "release_comments" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "Release comments are publicly readable" ON "release_comments" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can fully manage comments they leave on a release" ON "release_comments" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "release_comments"."user_id") WITH CHECK ((select auth.uid()) = "release_comments"."user_id");--> statement-breakpoint
CREATE POLICY "Artist managers can remove comments from a release that belongs to an artist they manage" ON "release_comments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_comments"."release_id")));