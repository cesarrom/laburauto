ALTER TABLE "bookings" ADD COLUMN "contract_signed_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "contract_fully_signed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "variable_values" jsonb;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "publisher_id" integer;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "renter_id" integer;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "booking_id" integer;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "stage_1_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "stage_1_completed_by" integer;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "stage_2_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "stage_2_completed_by" integer;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD COLUMN "variable_schema" jsonb;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_renter_id_users_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_stage_1_completed_by_users_id_fk" FOREIGN KEY ("stage_1_completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_stage_2_completed_by_users_id_fk" FOREIGN KEY ("stage_2_completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
