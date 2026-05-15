-- =====================================================
-- TABLE: water_level_hourly
-- ข้อมูลระดับน้ำราย observation
-- =====================================================

CREATE TABLE water_level_hourly (
    id BIGSERIAL PRIMARY KEY,

    station_code VARCHAR(20) NOT NULL,

    observed_at TIMESTAMPTZ NOT NULL,

    water_level NUMERIC(8,2),

    discharge NUMERIC(12,2),

    alert_level VARCHAR(20)
    DEFAULT 'normal'
    CHECK (
        alert_level IN (
            'normal',
            'warning',
            'prepare',
            'critical',
            'danger'
        )
    ),

    rise_1h NUMERIC(6,2),
    rise_3h NUMERIC(6,2),
    rise_6h NUMERIC(6,2),

    source_url TEXT,

    raw_json JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_hourly_station
        FOREIGN KEY (station_code)
        REFERENCES water_station(station_code)
        ON DELETE CASCADE
);

COMMENT ON TABLE water_level_hourly
IS 'ข้อมูลระดับน้ำรายชั่วโมง/ราย observation';

COMMENT ON COLUMN water_level_hourly.station_code
IS 'รหัสสถานีวัดน้ำ';

COMMENT ON COLUMN water_level_hourly.observed_at
IS 'เวลาที่วัดจริงจากต้นทาง ไม่ใช่เวลาที่ระบบดึงข้อมูล';

COMMENT ON COLUMN water_level_hourly.water_level
IS 'ระดับน้ำ หน่วยเมตร (m.)';

COMMENT ON COLUMN water_level_hourly.discharge
IS 'ปริมาณน้ำไหล หน่วยลูกบาศก์เมตรต่อวินาที (m3/sec)';

COMMENT ON COLUMN water_level_hourly.alert_level
IS 'ระดับความเสี่ยงที่ระบบคำนวณแล้ว';

COMMENT ON COLUMN water_level_hourly.rise_1h
IS 'ค่าระดับน้ำเพิ่มขึ้นใน 1 ชั่วโมงล่าสุด';

COMMENT ON COLUMN water_level_hourly.rise_3h
IS 'ค่าระดับน้ำเพิ่มขึ้นใน 3 ชั่วโมงล่าสุด';

COMMENT ON COLUMN water_level_hourly.rise_6h
IS 'ค่าระดับน้ำเพิ่มขึ้นใน 6 ชั่วโมงล่าสุด';

COMMENT ON COLUMN water_level_hourly.source_url
IS 'API endpoint ต้นทางที่ใช้ดึงข้อมูล';

COMMENT ON COLUMN water_level_hourly.raw_json
IS 'เก็บ raw payload จาก API เพื่อ audit/debug';

COMMENT ON COLUMN water_level_hourly.created_at
IS 'เวลาที่ระบบเรา ingest ข้อมูล';