CREATE TABLE water_station_pair_source (
    id BIGSERIAL PRIMARY KEY,

    station_id1 VARCHAR(20) NOT NULL,
    station_id2 VARCHAR(20),

    river_basin TEXT,

    address_1 TEXT,
    address_2 TEXT,

    level_limit1 NUMERIC(8,2),
    discharge_limit1 NUMERIC(12,2),

    level_limit2 NUMERIC(8,2),
    discharge_limit2 NUMERIC(12,2),

    source_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(station_id1, station_id2)
);