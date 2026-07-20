CREATE TABLE "artist_followers" (
	"user_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_followers_user_id_artist_id_pk" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
ALTER TABLE "artist_followers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artist_followers" ADD CONSTRAINT "artist_followers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_followers" ADD CONSTRAINT "artist_followers_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_followers_artist_id_idx" ON "artist_followers" USING btree ("artist_id");--> statement-breakpoint
CREATE POLICY "Artist followers are publicly readable" ON "artist_followers" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can follow an artist" ON "artist_followers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "artist_followers"."user_id");--> statement-breakpoint
CREATE POLICY "Users can unfollow an artist" ON "artist_followers" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "artist_followers"."user_id");--> statement-breakpoint
CREATE POLICY "Artist managers can remove followers from the artist" ON "artist_followers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_artist_manager("artist_followers"."artist_id"));