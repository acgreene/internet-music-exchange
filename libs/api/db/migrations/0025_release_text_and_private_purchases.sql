ALTER TABLE "users" ADD COLUMN "hide_purchases" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "lyrics" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "credits" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_lyrics_max_length" CHECK (length("tracks"."lyrics") <= 20000);--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_description_max_length" CHECK (length("releases"."description") <= 5000);--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_credits_max_length" CHECK (length("releases"."credits") <= 5000);