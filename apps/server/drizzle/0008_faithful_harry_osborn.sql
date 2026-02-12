ALTER TABLE "contract_instances" ADD COLUMN IF NOT EXISTS "email_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN IF NOT EXISTS "email_opened_at" timestamp;