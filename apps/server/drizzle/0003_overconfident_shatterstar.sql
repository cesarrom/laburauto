CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"reviewer_id" integer NOT NULL,
	"reviewee_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_proof_url" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "dispute_status" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "dispute_notes" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "location_shared_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "renter_can_see_location" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "arrived_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "rental_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "handoff_type" text DEFAULT 'idle_location';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "handoff_location" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "handoff_lat" double precision;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "handoff_long" double precision;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "handoff_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "returned_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "return_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "return_photo_url" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refund_status" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "extension_requested" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "extension_end_date" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "extension_price" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "emergency_triggered_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "emergency_notes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_phone" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "reviewed_by" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;