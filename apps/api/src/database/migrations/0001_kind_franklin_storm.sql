CREATE TYPE "public"."ingestion_status" AS ENUM('uploaded', 'extracting', 'analyzing', 'ready', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('language', 'framework', 'tool', 'platform', 'database', 'soft', 'domain', 'other');--> statement-breakpoint
CREATE TABLE "resume_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"is_valid" boolean NOT NULL,
	"rejection_reason" text,
	"raw_response" jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_ingestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" "ingestion_status" DEFAULT 'uploaded' NOT NULL,
	"failure_reason" text,
	"job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "resume_ingestions_storageKey_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "resume_education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"institution" text NOT NULL,
	"degree" text,
	"field" text,
	"start_date_raw" text,
	"end_date_raw" text,
	"start_date" date,
	"end_date" date,
	"grade" text
);
--> statement-breakpoint
CREATE TABLE "resume_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"start_date_raw" text,
	"end_date_raw" text,
	"start_date" date,
	"end_date" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"summary" text,
	"highlights" text[]
);
--> statement-breakpoint
CREATE TABLE "resume_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"technologies" text[],
	"url" text,
	"start_date_raw" text,
	"end_date_raw" text,
	"start_date" date,
	"end_date" date
);
--> statement-breakpoint
CREATE TABLE "resume_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"category" "skill_category" DEFAULT 'other' NOT NULL,
	"years_experience" numeric(4, 1)
);
--> statement-breakpoint
CREATE TABLE "resume_texts" (
	"ingestion_id" uuid PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"char_count" integer NOT NULL,
	"page_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"extraction_id" uuid NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"full_name" text,
	"email" text,
	"phone" text,
	"location" text,
	"headline" text,
	"summary" text,
	"years_experience_total" numeric(4, 1),
	"links" jsonb,
	"extras" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume_extractions" ADD CONSTRAINT "resume_extractions_ingestion_id_resume_ingestions_id_fk" FOREIGN KEY ("ingestion_id") REFERENCES "public"."resume_ingestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_ingestions" ADD CONSTRAINT "resume_ingestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_education" ADD CONSTRAINT "resume_education_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_experiences" ADD CONSTRAINT "resume_experiences_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_projects" ADD CONSTRAINT "resume_projects_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_texts" ADD CONSTRAINT "resume_texts_ingestion_id_resume_ingestions_id_fk" FOREIGN KEY ("ingestion_id") REFERENCES "public"."resume_ingestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_id_resume_ingestions_id_fk" FOREIGN KEY ("id") REFERENCES "public"."resume_ingestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_extraction_id_resume_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."resume_extractions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_extractions_ingestion_idx" ON "resume_extractions" USING btree ("ingestion_id","created_at");--> statement-breakpoint
CREATE INDEX "resume_ingestions_user_idx" ON "resume_ingestions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "resume_education_resume_idx" ON "resume_education" USING btree ("resume_id","order_index");--> statement-breakpoint
CREATE INDEX "resume_experiences_resume_idx" ON "resume_experiences" USING btree ("resume_id","order_index");--> statement-breakpoint
CREATE INDEX "resume_projects_resume_idx" ON "resume_projects" USING btree ("resume_id","order_index");--> statement-breakpoint
CREATE INDEX "resume_skills_resume_idx" ON "resume_skills" USING btree ("resume_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resume_skills_unique_per_resume" ON "resume_skills" USING btree ("resume_id","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "resumes_one_active_per_user" ON "resumes" USING btree ("user_id") WHERE "resumes"."is_active";