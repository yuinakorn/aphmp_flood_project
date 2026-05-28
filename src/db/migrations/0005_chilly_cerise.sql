CREATE TABLE "geo_districts" (
	"id" integer PRIMARY KEY NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"province_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_provinces" (
	"id" integer PRIMARY KEY NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text
);
--> statement-breakpoint
CREATE TABLE "geo_subdistricts" (
	"id" integer PRIMARY KEY NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"zip_code" integer,
	"district_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "geo_districts" ADD CONSTRAINT "geo_districts_province_id_geo_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."geo_provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_subdistricts" ADD CONSTRAINT "geo_subdistricts_district_id_geo_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."geo_districts"("id") ON DELETE no action ON UPDATE no action;