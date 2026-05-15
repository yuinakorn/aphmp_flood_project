CREATE TABLE water_level_observation (
    id BIGSERIAL PRIMARY KEY,

    station_id1 VARCHAR(20) NOT NULL,
    station_id2 VARCHAR(20),

    observed_date DATE NOT NULL,

    observed_time TIME NOT NULL,

    observed_at TIMESTAMPTZ GENERATED ALWAYS AS (
        (
            observed_date + observed_time
        )::timestamp
        AT TIME ZONE 'Asia/Bangkok'
    ) STORED,

    level_station1 NUMERIC(8,2),
    discharge_station1 NUMERIC(12,2),

    level_station2 NUMERIC(8,2),
    discharge_station2 NUMERIC(12,2),

    raw_json JSONB,

    ingested_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (
        station_id1,
        station_id2,
        observed_date,
        observed_time
    )
);