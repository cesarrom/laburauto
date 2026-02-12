CREATE TABLE "publisher_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"publisher_id" integer NOT NULL,
	"vehicle_id" integer,
	"registration_certificate" text NOT NULL,
	"proof_of_insurance" text NOT NULL,
	"technical_inspection" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_publisher_vehicle" UNIQUE("publisher_id","vehicle_id")
);
--> statement-breakpoint
ALTER TABLE "publisher_documents" ADD CONSTRAINT "publisher_documents_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publisher_documents" ADD CONSTRAINT "publisher_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;

COMMENT ON COLUMN contract_templates.variable_schema IS 'Defines available variables for this template type (publisher, renter, vehicle, booking contexts)';

COMMENT ON COLUMN contract_instances.variable_values IS 'Actual values used to replace variables in this instance';
COMMENT ON COLUMN contract_instances.stage_1_completed_at IS 'Timestamp when Stage 1 (usually publisher) signed';
COMMENT ON COLUMN contract_instances.stage_2_completed_at IS 'Timestamp when Stage 2 (usually renter) signed';
COMMENT ON COLUMN bookings.contract_signed_at IS 'When both parties completed signing the rental agreement';
COMMENT ON COLUMN bookings.contract_fully_signed IS 'True when both publisher and renter have signed';
CREATE INDEX idx_publisher_documents_publisher ON publisher_documents(publisher_id);
CREATE INDEX idx_publisher_documents_vehicle ON publisher_documents(vehicle_id);

COMMENT ON TABLE publisher_documents IS 'Stores required legal documents for each vehicle published on the platform';
COMMENT ON COLUMN publisher_documents.registration_certificate IS 'Vehicle registration document (Cédula Verde or Título)';
COMMENT ON COLUMN publisher_documents.proof_of_insurance IS 'Current insurance policy document';
COMMENT ON COLUMN publisher_documents.technical_inspection IS 'Technical inspection certificate (VTV) - optional';

-- 5. Add indexes for performance
CREATE INDEX idx_contract_instances_booking ON contract_instances(booking_id);
CREATE INDEX idx_contract_instances_publisher ON contract_instances(publisher_id);
CREATE INDEX idx_contract_instances_renter ON contract_instances(renter_id);
CREATE INDEX idx_contract_instances_stages ON contract_instances(stage_1_completed_at, stage_2_completed_at);