ALTER TABLE "bookings" ADD COLUMN "payment_proof_hash" text;--> statement-breakpoint
ALTER TABLE "photo_audits" ADD COLUMN "photo_hashes" jsonb;