ALTER TABLE "reserve_entries" DROP CONSTRAINT "reserve_entries_kind_rules";--> statement-breakpoint
ALTER TABLE "reserve_entries" ADD CONSTRAINT "reserve_entries_kind_rules" CHECK (CASE "reserve_entries"."kind"
        WHEN 'donation' THEN "reserve_entries"."amount" > 0 AND "reserve_entries"."contribution_id" IS NOT NULL
        WHEN 'surplus' THEN "reserve_entries"."amount" > 0 AND "reserve_entries"."month" IS NOT NULL
        WHEN 'funding' THEN "reserve_entries"."amount" > 0 AND "reserve_entries"."contribution_id" IS NULL
        ELSE "reserve_entries"."amount" < 0 AND "reserve_entries"."month" IS NOT NULL
      END);