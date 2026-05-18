CREATE TABLE "water_station_pair" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"upstream_station" varchar(20) NOT NULL,
	"downstream_station" varchar(20) NOT NULL,
	"river_basin" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "water_station" (
	"station_code" varchar(20) PRIMARY KEY NOT NULL,
	"station_name_th" text NOT NULL,
	"station_name_en" text,
	"river_basin" text,
	"province" text,
	"district" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"warning_level" numeric(6, 2),
	"prepare_level" numeric(6, 2),
	"critical_level" numeric(6, 2),
	"danger_level" numeric(6, 2),
	"rapid_rise_threshold" numeric(6, 2),
	"warning_discharge" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "water_station_pair" ADD CONSTRAINT "water_station_pair_upstream_station_water_station_station_code_fk" FOREIGN KEY ("upstream_station") REFERENCES "public"."water_station"("station_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_station_pair" ADD CONSTRAINT "water_station_pair_downstream_station_water_station_station_code_fk" FOREIGN KEY ("downstream_station") REFERENCES "public"."water_station"("station_code") ON DELETE cascade ON UPDATE no action;