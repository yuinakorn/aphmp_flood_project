-- =====================================================
-- TABLE: water_station
-- master สถานีวัดระดับน้ำ
-- =====================================================

CREATE TABLE water_station (
    station_code VARCHAR(20) PRIMARY KEY,

    station_name_th VARCHAR(255) NOT NULL,
    station_name_en VARCHAR(255),

    river_basin VARCHAR(100),

    province VARCHAR(100),
    district VARCHAR(100),

    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),

    warning_level NUMERIC(6,2),
    prepare_level NUMERIC(6,2),
    critical_level NUMERIC(6,2),
    danger_level NUMERIC(6,2),

    warning_discharge NUMERIC(12,2),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE water_station
IS 'ข้อมูล master ของสถานีวัดระดับน้ำ';

COMMENT ON COLUMN water_station.station_code
IS 'รหัสสถานี เช่น P.1, P.67, Y.31';

COMMENT ON COLUMN water_station.station_name_th
IS 'ชื่อสถานีภาษาไทย';

COMMENT ON COLUMN water_station.station_name_en
IS 'ชื่อสถานีภาษาอังกฤษ';

COMMENT ON COLUMN water_station.river_basin
IS 'ลุ่มน้ำ เช่น PING, WANG, YOM, NAN';

COMMENT ON COLUMN water_station.warning_level
IS 'ระดับเริ่มเฝ้าระวัง (เมตร)';

COMMENT ON COLUMN water_station.prepare_level
IS 'ระดับเตรียมพร้อมรับมือ (เมตร)';

COMMENT ON COLUMN water_station.critical_level
IS 'ระดับวิกฤต ใกล้ล้นตลิ่ง (เมตร)';

COMMENT ON COLUMN water_station.danger_level
IS 'ระดับอันตรายสูง ต้อง activate response';

COMMENT ON COLUMN water_station.warning_discharge
IS 'ปริมาณการไหลที่เริ่มเฝ้าระวัง (ลบ.ม./วินาที)';