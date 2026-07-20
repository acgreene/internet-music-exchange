CREATE TYPE "public"."audio_format" AS ENUM('flac', 'wav', 'aiff', 'alac', 'aac', 'mp3', 'opus');--> statement-breakpoint
CREATE TYPE "public"."audio_variant" AS ENUM('original', 'stream');--> statement-breakpoint
CREATE TYPE "public"."release_asset_kind" AS ENUM('cover', 'back_cover', 'liner_notes', 'photo', 'video', 'audio', 'document', 'other');--> statement-breakpoint
CREATE TABLE "track_audio_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"variant" "audio_variant" NOT NULL,
	"format" "audio_format" NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"sample_rate_hz" integer,
	"bit_depth" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_audio_files_track_id_variant_unique" UNIQUE("track_id","variant"),
	CONSTRAINT "track_audio_files_bucket_object_key_unique" UNIQUE("bucket","object_key"),
	CONSTRAINT "track_audio_files_byte_size_positive" CHECK ("track_audio_files"."byte_size" > 0),
	CONSTRAINT "track_audio_files_sample_rate_positive" CHECK ("track_audio_files"."sample_rate_hz" IS NULL OR "track_audio_files"."sample_rate_hz" > 0),
	CONSTRAINT "track_audio_files_bit_depth_positive" CHECK ("track_audio_files"."bit_depth" IS NULL OR "track_audio_files"."bit_depth" > 0)
);
--> statement-breakpoint
ALTER TABLE "track_audio_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "release_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"kind" "release_asset_kind" NOT NULL,
	"title" text,
	"description" text,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"requires_purchase" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_assets_bucket_object_key_unique" UNIQUE("bucket","object_key"),
	CONSTRAINT "release_assets_byte_size_positive" CHECK ("release_assets"."byte_size" > 0),
	CONSTRAINT "release_assets_position_not_negative" CHECK ("release_assets"."position" >= 0),
	CONSTRAINT "release_assets_cover_is_public" CHECK ("release_assets"."kind" <> 'cover' OR "release_assets"."requires_purchase" = false),
	CONSTRAINT "release_assets_back_cover_is_public" CHECK ("release_assets"."kind" <> 'back_cover' OR "release_assets"."requires_purchase" = false)
);
--> statement-breakpoint
ALTER TABLE "release_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "track_audio_files" ADD CONSTRAINT "track_audio_files_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_assets" ADD CONSTRAINT "release_assets_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_audio_files_track_id_idx" ON "track_audio_files" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "release_assets_release_id_idx" ON "release_assets" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_assets_one_cover_per_release_idx" ON "release_assets" USING btree ("release_id") WHERE kind = 'cover';--> statement-breakpoint
CREATE UNIQUE INDEX "release_assets_one_back_cover_per_release_idx" ON "release_assets" USING btree ("release_id") WHERE kind = 'back_cover';--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_duration_ms_positive" CHECK ("tracks"."duration_ms" > 0);--> statement-breakpoint
CREATE POLICY "Managers can read audio files for their tracks" ON "track_audio_files" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_artist_manager((SELECT t.artist_id FROM public.tracks t WHERE t.id = "track_audio_files"."track_id")));--> statement-breakpoint
CREATE POLICY "Public release assets are publicly readable" ON "release_assets" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("release_assets"."requires_purchase" = false AND EXISTS (SELECT 1 FROM public.releases r WHERE r.id = "release_assets"."release_id" AND r.status = 'published'));--> statement-breakpoint
CREATE POLICY "Managers can read their release assets" ON "release_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_artist_manager((SELECT r.artist_id FROM public.releases r WHERE r.id = "release_assets"."release_id")));