CREATE TABLE "release_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"bucket" text,
	"object_key" text,
	"byte_size" bigint,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_archives_release_id_fingerprint_unique" UNIQUE("release_id","fingerprint"),
	CONSTRAINT "release_archives_ready_has_object" CHECK ("release_archives"."ready_at" IS NULL OR ("release_archives"."bucket" IS NOT NULL AND "release_archives"."object_key" IS NOT NULL AND "release_archives"."byte_size" > 0))
);
--> statement-breakpoint
ALTER TABLE "release_archives" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "release_archives" ADD CONSTRAINT "release_archives_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "release_archives_pending_idx" ON "release_archives" USING btree ("requested_at") WHERE "release_archives"."ready_at" IS NULL;