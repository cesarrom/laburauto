ALTER TABLE "users" ADD COLUMN "dlocal_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" text DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bank_account_cbu" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bank_account_holder" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bank_name" text;