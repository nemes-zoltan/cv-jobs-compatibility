CREATE TYPE "public"."flag_category" AS ENUM('compensation', 'culture', 'expectations', 'role_clarity', 'process', 'stability', 'growth', 'other');--> statement-breakpoint
CREATE TYPE "public"."flag_polarity" AS ENUM('red', 'green', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."interview_process_basis" AS ENUM('stated_in_posting', 'inferred_from_role_type');--> statement-breakpoint
CREATE TYPE "public"."gap_type" AS ENUM('quick_to_learn', 'needs_a_project', 'needs_years');--> statement-breakpoint
CREATE TYPE "public"."match_recommendation" AS ENUM('apply_now', 'tailor_first', 'close_gaps_first', 'skip');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('queued', 'analyzing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."match_verdict" AS ENUM('strong_fit', 'stretch', 'reach', 'mismatch');--> statement-breakpoint
CREATE TYPE "public"."skill_verdict" AS ENUM('yes', 'partial', 'no');--> statement-breakpoint
CREATE TYPE "public"."requirement_kind" AS ENUM('skill', 'experience', 'education', 'certification', 'language', 'eligibility', 'other');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('high_school', 'associate', 'bachelor', 'master', 'doctorate');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'internship', 'temporary');--> statement-breakpoint
CREATE TYPE "public"."job_insights_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'analyzing', 'ready', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."requirement_importance" AS ENUM('required', 'preferred');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('hour', 'day', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."seniority_level" AS ENUM('intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'lead', 'manager', 'director');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('onsite', 'hybrid', 'remote');--> statement-breakpoint
CREATE TABLE "job_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
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
CREATE TABLE "job_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"polarity" "flag_polarity" NOT NULL,
	"category" "flag_category" NOT NULL,
	"text" text NOT NULL,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_insights" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"company_facts" jsonb,
	"interview_basis" "interview_process_basis",
	"interview_stages" jsonb,
	"interview_questions" jsonb,
	"raw_response" jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_match_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"stars" smallint NOT NULL,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_match_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"verdict" "skill_verdict" NOT NULL,
	"gap_type" "gap_type",
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'queued' NOT NULL,
	"failure_reason" text,
	"score" integer,
	"verdict" "match_verdict",
	"recommendation" "match_recommendation",
	"meets_years_requirement" boolean,
	"essentials" jsonb,
	"summary" text,
	"strengths" text[],
	"gaps" text[],
	"tailored_questions" jsonb,
	"model" text,
	"prompt_version" text,
	"raw_response" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"text" text NOT NULL,
	"original_text" text,
	"importance" "requirement_importance" NOT NULL,
	"kind" "requirement_kind" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"category" "skill_category" DEFAULT 'other' NOT NULL,
	"importance" "requirement_importance" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_texts" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"char_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"failure_reason" text,
	"extraction_id" uuid,
	"insights_status" "job_insights_status" DEFAULT 'pending' NOT NULL,
	"queue_job_id" uuid,
	"title" text,
	"company" text,
	"locations" text[],
	"work_mode" "work_mode",
	"employment_type" "employment_type",
	"seniority" "seniority_level",
	"years_experience_min" numeric(4, 1),
	"years_experience_max" numeric(4, 1),
	"salary_min" numeric(12, 2),
	"salary_max" numeric(12, 2),
	"salary_currency" text,
	"salary_period" "salary_period",
	"industry" text,
	"team_context" text,
	"summary" text,
	"education_level" "education_level",
	"education_field" text,
	"education_importance" "requirement_importance",
	"extras" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "jobs_contentHash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "saved_jobs" (
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_jobs_user_id_job_id_pk" PRIMARY KEY("user_id","job_id")
);
--> statement-breakpoint
ALTER TABLE "job_extractions" ADD CONSTRAINT "job_extractions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_flags" ADD CONSTRAINT "job_flags_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_insights" ADD CONSTRAINT "job_insights_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match_requirements" ADD CONSTRAINT "job_match_requirements_match_id_job_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."job_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match_requirements" ADD CONSTRAINT "job_match_requirements_requirement_id_job_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."job_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match_skills" ADD CONSTRAINT "job_match_skills_match_id_job_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."job_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match_skills" ADD CONSTRAINT "job_match_skills_skill_id_job_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."job_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_texts" ADD CONSTRAINT "job_texts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_extraction_id_job_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."job_extractions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_extractions_job_idx" ON "job_extractions" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "job_flags_job_idx" ON "job_flags" USING btree ("job_id","order_index");--> statement-breakpoint
CREATE INDEX "job_match_requirements_match_idx" ON "job_match_requirements" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "job_match_skills_match_idx" ON "job_match_skills" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_matches_unique_per_resume" ON "job_matches" USING btree ("job_id","resume_id");--> statement-breakpoint
CREATE INDEX "job_matches_resume_idx" ON "job_matches" USING btree ("resume_id","score");--> statement-breakpoint
CREATE INDEX "job_requirements_job_idx" ON "job_requirements" USING btree ("job_id","order_index");--> statement-breakpoint
CREATE INDEX "job_skills_job_idx" ON "job_skills" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_skills_unique_per_job" ON "job_skills" USING btree ("job_id","normalized_name");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "saved_jobs_user_idx" ON "saved_jobs" USING btree ("user_id","created_at");