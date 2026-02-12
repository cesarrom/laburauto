ALTER TABLE "vehicles" DROP COLUMN "photos";--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN "document_urls";--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "photos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "document_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;