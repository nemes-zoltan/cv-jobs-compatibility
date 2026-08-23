CREATE TYPE "public"."flag_source_kind" AS ENUM('posting', 'web');--> statement-breakpoint
ALTER TYPE "public"."flag_category" ADD VALUE 'interviewing' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."flag_category" ADD VALUE 'management' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "job_flags" ADD COLUMN "source_kind" "flag_source_kind" DEFAULT 'posting' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_flags" ADD COLUMN "source_label" text;--> statement-breakpoint
ALTER TABLE "job_flags" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "job_flags" ADD COLUMN "source_date" text;