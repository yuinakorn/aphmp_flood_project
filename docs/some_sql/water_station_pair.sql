water_station_pair-- =====================================================
-- TABLE: water_station_pair
-- relation upstream/downstream
-- =====================================================

CREATE TABLE water_station_pair (
    id BIGSERIAL PRIMARY KEY,

    upstream_station VARCHAR(20) NOT NULL,
    downstream_station VARCHAR(20) NOT NULL,

    river_basin VARCHAR(100),

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_pair_upstream
        FOREIGN KEY (upstream_station)
        REFERENCES water_station(station_code)
        ON DELETE CASCADE,

    CONSTRAINT fk_pair_downstream
        FOREIGN KEY (downstream_station)
        REFERENCES water_station(station_code)
        ON DELETE CASCADE
);

COMMENT ON TABLE water_station_pair
IS 'ความสัมพันธ์ต้นน้ำและปลายน้ำ ใช้คาดการณ์น้ำเดินทาง';

COMMENT ON COLUMN water_station_pair.upstream_station
IS 'สถานีต้นน้ำ เช่น P.67';

COMMENT ON COLUMN water_station_pair.downstream_station
IS 'สถานีปลายน้ำ เช่น P.1';

COMMENT ON COLUMN water_station_pair.active
IS 'เปิดใช้งาน relation นี้หรือไม่';