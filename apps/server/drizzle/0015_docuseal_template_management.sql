CREATE TABLE "docuseal_active_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_type" text NOT NULL,
	"template_id" integer NOT NULL,
	"docuseal_template_id" text NOT NULL,
	"docuseal_template_name" text,
	"activated_by" integer,
	"activated_at" timestamp DEFAULT now(),
	CONSTRAINT "docuseal_active_templates_contract_type_unique" UNIQUE("contract_type")
);
--> statement-breakpoint
CREATE TABLE "docuseal_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"docuseal_template_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"external_id" text,
	"folder_name" text,
	"preview_image_url" text,
	"shared_link" boolean,
	"matches_filter" boolean DEFAULT false,
	"stage_count" integer,
	"field_count" integer,
	"submitter_count" integer,
	"docuseal_created_at" timestamp,
	"docuseal_updated_at" timestamp,
	"last_synced_at" timestamp DEFAULT now(),
	CONSTRAINT "docuseal_template_id_unique" UNIQUE("docuseal_template_id")
);
--> statement-breakpoint
ALTER TABLE "docuseal_active_templates" ADD CONSTRAINT "docuseal_active_templates_template_id_docuseal_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."docuseal_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docuseal_active_templates" ADD CONSTRAINT "docuseal_active_templates_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;