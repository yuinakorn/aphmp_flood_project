-- =====================================================
-- TABLE: water_alert_log
-- log การแจ้งเตือน
-- =====================================================

CREATE TABLE water_alert_log (
    id BIGSERIAL PRIMARY KEY,

    station_code VARCHAR(20),

    observed_at TIMESTAMPTZ,

    water_level NUMERIC(8,2),
    discharge NUMERIC(12,2),

    alert_type VARCHAR(30)
    CHECK (
        alert_type IN (
            'warning',
            'prepare',
            'critical',
            'danger',
            'rapid_rise'
        )
    ),

    message TEXT,

    sent_line BOOLEAN DEFAULT FALSE,
    sent_telegram BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_alert_station
        FOREIGN KEY (station_code)
        REFERENCES water_station(station_code)
        ON DELETE CASCADE
);

COMMENT ON TABLE water_alert_log
IS 'ประวัติการแจ้งเตือน threshold และ rapid rise';

COMMENT ON COLUMN water_alert_log.alert_type
IS 'ประเภทการแจ้งเตือน';

COMMENT ON COLUMN water_alert_log.message
IS 'ข้อความที่ส่งแจ้งเตือน';

COMMENT ON COLUMN water_alert_log.sent_line
IS 'ส่ง LINE สำเร็จหรือไม่';

COMMENT ON COLUMN water_alert_log.sent_telegram
IS 'ส่ง Telegram สำเร็จหรือไม่';