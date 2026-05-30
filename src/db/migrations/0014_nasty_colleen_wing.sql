ALTER TABLE "access_log" DROP CONSTRAINT "access_log_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "case_assignments" DROP CONSTRAINT "case_assignments_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "case_assignments" DROP CONSTRAINT "case_assignments_assigned_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "health_visits" DROP CONSTRAINT "health_visits_visited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "help_requests" DROP CONSTRAINT "help_requests_requested_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "household_members" DROP CONSTRAINT "household_members_assigned_vhv_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "household_members" DROP CONSTRAINT "household_members_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "shelter_admissions" DROP CONSTRAINT "shelter_admissions_admitted_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "shelter_status_snapshots" DROP CONSTRAINT "shelter_status_snapshots_reported_by_users_id_fk";
