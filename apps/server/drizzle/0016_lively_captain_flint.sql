ALTER TABLE "contract_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "contract_templates" CASCADE;--> statement-breakpoint
ALTER TABLE "contract_instances" DROP COLUMN "template_id";--> statement-breakpoint
ALTER TABLE "contract_instances" ADD COLUMN "contract_type" integer;--> statement-breakpoint
ALTER TABLE "contract_instances" DROP CONSTRAINT "contract_instances_template_id_contract_templates_id_fk";
--> statement-breakpoint
ALTER TABLE "contract_instances" DROP CONSTRAINT "contract_instances_stage_1_completed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contract_instances" DROP CONSTRAINT "contract_instances_stage_2_completed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contract_instances" DROP CONSTRAINT "contract_instances_stage_3_completed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contract_instances" DROP COLUMN "stage_1_completed_at";--> statement-breakpoint
ALTER TABLE "contract_instances" DROP COLUMN "stage_1_completed_by";--> statement-breakpoint
ALTER TABLE "contract_instances" DROP COLUMN "stage_2_completed_at";--> statement-breakpoint
ALTER TABLE "contract_instances" DROP COLUMN "stage_2_completed_by";--> statement-breakpoint
ALTER TABLE "contract_instances" DROP COLUMN "stage_3_completed_at";--> statement-breakpoint
ALTER TABLE "contract_instances" DROP COLUMN "stage_3_completed_by";