CREATE INDEX "idx_health_visits_incident_id" ON "health_visits" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_health_visits_member_observed" ON "health_visits" USING btree ("member_id","observed_at");--> statement-breakpoint
CREATE INDEX "idx_help_requests_incident_id" ON "help_requests" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_rescue_teams_incident_id" ON "rescue_teams" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_shelter_admissions_incident_id" ON "shelter_admissions" USING btree ("incident_id");