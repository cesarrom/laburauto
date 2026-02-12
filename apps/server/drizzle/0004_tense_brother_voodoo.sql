CREATE TABLE "contract_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"status" text DEFAULT 'pending',
	"final_pdf_url" text,
	"audit_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"signed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"pdf_url" text NOT NULL,
	"fields" jsonb NOT NULL,
	"stages" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photo_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"type" text NOT NULL,
	"photos" jsonb NOT NULL,
	"odometer_reading" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "contract_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reputation_score" integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "enrollment_contract_id" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "last_odometer" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "next_service_odometer" integer;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_audits" ADD CONSTRAINT "photo_audits_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;