# แผนพัฒนา FloodWatch น่าน ขึ้นระบบจริงด้วย Next.js

วิเคราะห์จาก [src/app/example/nan_flood_map_v4_2.html](src/app/example/nan_flood_map_v4_2.html) (single-file prototype, 446 บรรทัด, ~96KB inline GeoJSON)

---

## 1. วิเคราะห์ระบบเดิม (As-is)

### 1.1 สถาปัตยกรรม
ไฟล์ HTML เดี่ยว โหลด Leaflet + leaflet.heat จาก CDN ทำงานฝั่ง client ทั้งหมด ไม่มี backend ข้อมูลทั้งหมดถูก hard-code อยู่ใน `<script>`

### 1.2 องค์ประกอบหลัก

| ส่วน | รายละเอียด | ที่มา |
|---|---|---|
| Base maps | ESRI Satellite, OSM, ESRI Topo, Google Hybrid | tile servers สาธารณะ |
| FLOOD_POINTS | จุดน้ำท่วม 813 จุด `[lat, lng, intensity]` | Sentinel-1 SAR (ESA) ผ่าน GEE threshold `VV < -15dB` ส.ค.–ก.ย. 2024 |
| Heatmap | leaflet.heat radius/blur/gradient ปรับได้ | คำนวณจาก FLOOD_POINTS |
| Circle markers | วงกลมรัศมีปรับได้ 50–800m | FLOOD_POINTS |
| S2_FLOOD_GEOJSON | MultiPolygon ราย "ตำบล" (24 ก.ค. 2568) ขนาด ~96KB inline | Sentinel-2 (KMZ S2C_20250724_1036) จาก GISTDA |
| GISTDA WMS | `flood:flood_2024_geo` layer (ปิดไว้ default) | flood.gistda.or.th/geoserver |
| Vulnerable (15 คน) | ติดเตียง / สูงอายุ / พิการ / ตั้งครรภ์ พร้อม lat,lng,cond,eq | **demo hard-code** |
| Infrastructure (7 จุด) | รพ. / รพ.สต. / ศูนย์อพยพ / จุดรวมพล | **demo hard-code** |
| Evacuation routes | คำนวณ shelter ใกล้สุดด้วย euclidean distance แล้ววาด polyline 3 จุด (เพิ่ม jitter) | runtime |
| Risk classification | `nearFlood(lat,lng,thresh)` เช็คจุดน้ำท่วมในรัศมี 0.5km = flood / 2km = near / มิฉะนั้น safe | runtime, O(N×M) |

### 1.3 ปัญหาที่พบใน prototype

1. **Bundle ใหญ่** – GeoJSON 96KB ฝังในไฟล์ HTML, FLOOD_POINTS 813 จุดฝังเป็น literal array
2. **ไม่มี persistence** – แก้ไข/เพิ่มคนเปราะบางไม่ได้ ปิดเปิดก็หาย
3. **คำนวณระยะทางผิด** – ใช้ `sqrt((Δlat)² + (Δlng)²) × 111` ซึ่งคลาดเคลื่อนสูงนอกเส้นศูนย์สูตร (ที่ละติจูด 18° ระยะ lng จริง = `cos(18°)×111 ≈ 105.5 km/deg` ไม่ใช่ 111)
4. **Route หาเส้นทางไม่จริง** – แค่ลากเส้นตรง + jitter ระหว่างผู้ป่วยกับ shelter ไม่ผ่านถนนจริง ไม่หลบพื้นที่น้ำท่วม
5. **Performance** – render circles 813 จุดทุกครั้งที่เลื่อน slider radius ทำ DOM mutation หนัก
6. **ไม่มี role/auth** – ข้อมูลคนเปราะบางเป็น sensitive (PDPA) ใครเข้าก็เห็นชื่อ–โรค–บ้าน
7. **Hardcoded date** – Sentinel-2 ผูกวันที่ 24 ก.ค. 2568, S1 ผูก ส.ค.–ก.ย. 2024 ไม่มีกลไกอัปเดต
8. **No mobile UX** – `@media(max-width:768px){.sidebar{display:none}}` คือซ่อนทิ้ง ไม่ได้ออกแบบมือถือ
9. **ภาษา/timezone** – แสดงผลผสม พ.ศ./ค.ศ. (2568 vs 2024) ไม่ consistent
10. **ไม่มี error handling** – WMS GISTDA fail เงียบ, tile fail ไม่บอก user

---

## 2. แผนยกขึ้น Next.js (To-be)

### 2.1 Stack ที่แนะนำ

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | ตามที่มีอยู่ใน [package.json](package.json) |
| แผนที่ | **MapLibre GL JS** (แทน Leaflet) | render GeoJSON หลักหมื่น feature ลื่นกว่ามาก (WebGL), รองรับ vector tile, free |
| Heatmap | MapLibre native heatmap layer | ไม่ต้องลง leaflet.heat |
| Database | **PostgreSQL + PostGIS** | spatial query (`ST_DWithin`, `ST_Intersects`) คือหัวใจระบบนี้ |
| ORM | Prisma หรือ Drizzle (ผมแนะ Drizzle เพราะรองรับ PostGIS ผ่าน raw SQL ได้ดีกว่า) | type-safe |
| Auth | NextAuth (Auth.js) v5 + role (admin / officer / viewer) | PDPA compliance |
| Tile cache | self-host tiles ผ่าน `pmtiles` หรือใช้ MapTiler/Stadia | ลด dependency CDN ต่างประเทศ |
| Background jobs | Vercel Cron หรือ self-host BullMQ | ดึง S1/S2 ใหม่อัตโนมัติ |
| Storage | S3-compatible (R2/MinIO) | เก็บ raster Sentinel, KMZ, รูปประกอบเคส |
| Deploy | Vercel (Next.js) + Supabase หรือ Neon (Postgres+PostGIS) | เริ่มได้ฟรี |

> **ทำไมไม่ Leaflet?** Leaflet เป็น raster/DOM-based — circle 800 dots ยังพอไหว แต่ถ้าระบบจริงต้องโชว์ polygon ตำบลทั้งจังหวัด + ผู้ป่วยหลักพัน + เปิดหลายชั้น จะกระตุก MapLibre GL ใช้ GPU จัดการได้สบาย ของเดิม Leaflet ก็ยังพอใช้ในเฟส MVP ถ้าอยากย้ายน้อยที่สุด → ใช้ `react-leaflet` ก็ได้แต่ต้อง `dynamic(() => import(...), { ssr:false })`

### 2.2 โครงไฟล์ที่เสนอ

```
src/
├── app/
│   ├── (public)/
│   │   └── map/page.tsx              # public read-only flood viewer
│   ├── (admin)/
│   │   ├── layout.tsx                # auth guard
│   │   ├── vulnerable/page.tsx       # CRUD บุคคลเปราะบาง
│   │   ├── infra/page.tsx            # CRUD สถานพยาบาล/ศูนย์อพยพ
│   │   └── flood-events/page.tsx     # จัดการ flood event metadata
│   ├── api/
│   │   ├── flood-points/route.ts     # GET (?bbox=&date=) → GeoJSON
│   │   ├── flood-polygons/route.ts   # GET S2 polygons by date
│   │   ├── vulnerable/route.ts       # GET/POST (auth)
│   │   ├── vulnerable/[id]/route.ts  # PUT/DELETE
│   │   ├── infra/route.ts
│   │   ├── routes/evacuate/route.ts  # POST {personId} → optimal route
│   │   └── ingest/sentinel/route.ts  # webhook สำหรับ cron
│   └── layout.tsx
├── components/
│   ├── map/
│   │   ├── FloodMap.tsx              # MapLibre wrapper (client component)
│   │   ├── layers/FloodPointsLayer.tsx
│   │   ├── layers/HeatmapLayer.tsx
│   │   ├── layers/VulnerableLayer.tsx
│   │   └── controls/LayerControl.tsx
│   ├── sidebar/StatsPanel.tsx
│   └── sidebar/VulnerableList.tsx
├── lib/
│   ├── db.ts                         # drizzle client
│   ├── geo.ts                        # haversine, bbox helpers
│   ├── auth.ts                       # NextAuth config
│   └── gee.ts                        # Google Earth Engine client (server-side)
├── db/
│   └── schema.ts                     # drizzle schema (ดูข้อ 2.3)
└── workers/
    └── ingest-sentinel.ts            # cron job
```

### 2.3 Database schema (PostGIS)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1) Flood detections (จาก Sentinel-1 SAR)
CREATE TABLE flood_points (
  id          bigserial PRIMARY KEY,
  geom        geometry(Point, 4326) NOT NULL,
  intensity   smallint NOT NULL,
  source      text NOT NULL,           -- 'sentinel-1'
  observed_at date NOT NULL,           -- วันที่ภาพถ่าย
  ingested_at timestamptz DEFAULT now()
);
CREATE INDEX flood_points_geom_gix ON flood_points USING GIST (geom);
CREATE INDEX flood_points_date_idx ON flood_points (observed_at);

-- 2) Flood polygons (จาก Sentinel-2 หรือ GISTDA KMZ)
CREATE TABLE flood_polygons (
  id          bigserial PRIMARY KEY,
  geom        geometry(MultiPolygon, 4326) NOT NULL,
  tambon      text,
  amphoe      text,
  province    text,
  source      text NOT NULL,           -- 'sentinel-2' | 'gistda'
  observed_at date NOT NULL,
  area_sqkm   numeric GENERATED ALWAYS AS (ST_Area(geom::geography)/1e6) STORED
);
CREATE INDEX flood_polygons_geom_gix ON flood_polygons USING GIST (geom);

-- 3) Vulnerable persons (PDPA — เข้ารหัสคอลัมน์ sensitive)
CREATE TABLE vulnerable_persons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_enc    bytea NOT NULL,          -- pgcrypto AES
  citizen_id_enc bytea,                -- เลขบัตร 13 หลัก (encrypted)
  type        text NOT NULL CHECK (type IN ('bedridden','elderly','disabled','pregnant')),
  age         smallint,
  condition   text,
  equipment   text,
  village     text,
  geom        geometry(Point, 4326) NOT NULL,
  caregiver_phone_enc bytea,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX vp_geom_gix ON vulnerable_persons USING GIST (geom);

-- 4) Infrastructure
CREATE TABLE infrastructures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('hospital','clinic','shelter','assembly')),
  capacity    integer,
  geom        geometry(Point, 4326) NOT NULL,
  contact     text
);
CREATE INDEX infra_geom_gix ON infrastructures USING GIST (geom);

-- 5) Users (admin/officer/viewer)
CREATE TABLE users (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email    text UNIQUE NOT NULL,
  role     text NOT NULL CHECK (role IN ('admin','officer','viewer')),
  ...
);

-- 6) Audit log (สำหรับ PDPA)
CREATE TABLE access_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id),
  action      text,        -- 'view_vulnerable', 'export'
  target_id   uuid,
  ip          inet,
  at          timestamptz DEFAULT now()
);
```

### 2.4 API endpoint ที่สำคัญ

| Method & Path | หน้าที่ | Auth |
|---|---|---|
| `GET /api/flood-points?bbox=&from=&to=` | คืน GeoJSON FeatureCollection (ใช้ `ST_MakeEnvelope` กรอง bbox) | public |
| `GET /api/flood-polygons?date=2025-07-24` | คืนพื้นที่น้ำท่วม S2 | public |
| `GET /api/vulnerable?bbox=` | คืน Geo + ชื่อย่อ (mask) ถ้า role=viewer; full ถ้า officer+ | auth |
| `POST /api/vulnerable` | สร้าง | officer/admin |
| `POST /api/routes/evacuate` | คำนวณเส้นทางอพยพจริงผ่าน OSRM/Valhalla, weight ทาง×(1 – flood_risk) | officer/admin |
| `GET /api/stats?bbox=` | คืน aggregate: in_flood/near/safe จำนวน | public(masked)/auth(full) |

### 2.5 การคำนวณ risk ที่ถูกต้อง

แทน `nearFlood()` ที่ใช้ pythagorean
```sql
-- ในระยะ 500m = flood, 2km = near
SELECT
  v.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM flood_polygons fp
      WHERE fp.observed_at = $1 AND ST_Intersects(fp.geom, v.geom)
    ) THEN 'flood'
    WHEN EXISTS (
      SELECT 1 FROM flood_polygons fp
      WHERE fp.observed_at = $1
      AND ST_DWithin(fp.geom::geography, v.geom::geography, 2000)
    ) THEN 'near'
    ELSE 'safe'
  END AS risk
FROM vulnerable_persons v
WHERE ST_Within(v.geom, ST_MakeEnvelope($2,$3,$4,$5,4326));
```
ใช้ `geography` ทำให้คำนวณเป็นเมตรจริงไม่ใช่หน่วยองศา และมี GiST index → ms-level

### 2.6 Roadmap (เฟส)

| Phase | ระยะเวลา | ส่งมอบ |
|---|---|---|
| **0 – Setup** | 1 wk | Repo, Postgres+PostGIS, NextAuth, deploy pipeline |
| **1 – Data migration** | 1 wk | Script แปลง FLOOD_POINTS + S2_FLOOD_GEOJSON เข้า DB |
| **2 – Map MVP** | 2 wk | Public viewer ดึง flood points/polygons จาก API + base layers + heatmap |
| **3 – Vulnerable CRUD** | 2 wk | Admin form, geocoder, role/auth, audit log, encryption |
| **4 – Risk & stats** | 1 wk | Server-side risk calculation, stats endpoint, color-coded markers |
| **5 – Real routing** | 2 wk | OSRM container + flood-aware weight + multi-shelter |
| **6 – Ingest pipeline** | 2 wk | Cron + GEE → S1, KMZ parser → S2 |
| **7 – Mobile + PWA** | 1 wk | Responsive sidebar เป็น bottom-sheet, offline map (pmtiles) |
| **8 – Hardening** | 1 wk | E2E test, load test 100k flood points, PDPA review |

---

## 3. ข้อเสนอเพื่อทำให้ดีขึ้น

### 3.1 ด้านข้อมูล (สำคัญสุด)
- **อย่าฝัง GeoJSON ใน bundle** ใช้ vector tile (PMTiles/MVT) จะลด initial JS ~96KB เหลือ ~0 ทันที และ map ลื่นกว่าเดิม
- **ใช้ Cloud Optimized GeoTIFF (COG)** เก็บ Sentinel raster จริง แล้ว serve ผ่าน TiTiler → ผู้ใช้กดเลือกวันที่ดูภาพย้อนหลังได้
- **เก็บ time-series** ทุก flood detection มี `observed_at` → ทำ slider เลื่อนวันที่ ดู progression ของน้ำท่วมได้
- **Unify timezone/calendar** เก็บ UTC ใน DB, แสดง พ.ศ. ใน UI เท่านั้น (ใช้ `Intl.DateTimeFormat('th-TH-u-ca-buddhist')`)

### 3.2 ด้าน UX
- **Bottom sheet มือถือ** (เช่น `vaul`) แทน sidebar ที่ซ่อนทั้งดุ้น
- **Time slider** เห็นน้ำขยาย/ยุบตามวัน
- **Cluster markers** ของ vulnerable เมื่อ zoom out (`supercluster`)
- **Permalink** `?lat=&lng=&zoom=&layers=heatmap,s2flood` เพื่อแชร์มุมมอง
- **Offline-first** ใช้ PWA + IndexedDB cache layer ที่เลือกไว้ (เจ้าหน้าที่ลงพื้นที่ไม่มีเน็ตได้)
- **Print/Export** export PDF รายงานพื้นที่ + รายชื่อในรัศมีให้ อบต./ปภ.

### 3.3 ด้าน routing
- ใช้ **OSRM** หรือ **Valhalla** self-host พร้อม OSM Thailand
- ตั้ง custom cost: edge ที่ตัดกับ `flood_polygons` ปัจจุบัน → weight × 10 หรือ exclude
- รองรับ "หลายผู้ป่วย → หลาย shelter" ด้วย VRP solver (เช่น `jsprit`, OR-Tools)
- คำนวณ ETA + capacity ของ shelter (ไม่ส่งคนเกิน cap)

### 3.4 ด้าน ML / value-add
- **Forecasting** เอา rainfall (TMD API) + DEM + soil → train model พยากรณ์พื้นที่เสี่ยง 24/48/72 ชม. ข้างหน้า
- **Change detection อัตโนมัติ** ทุก S1 pass ใหม่ → diff กับ baseline แล้ว push notification ให้ officer
- **LINE Notify / SMS** ส่งแจ้งเตือนอัตโนมัติเมื่อบ้านผู้ป่วยติดเตียงเข้าเขตเสี่ยง

### 3.5 ด้านความปลอดภัย / PDPA (จำเป็นมาก เพราะข้อมูลคนเปราะบาง)
- ผู้ใช้ทั่วไป (anonymous) เห็นเฉพาะ aggregate count ต่อหมู่บ้าน **ไม่เห็นชื่อ/พิกัดบุคคล**
- Officer ต้องล็อกอินถึงเห็นรายบุคคล + ทุก view เขียน audit log
- เข้ารหัส column `name`, `citizen_id`, `phone` ด้วย `pgcrypto` (`pgp_sym_encrypt`)
- มี **consent flag** ต่อราย ว่าญาติยินยอมให้เก็บข้อมูล
- Data retention policy (เช่นลบหลัง 5 ปีถ้าไม่มีอัปเดต)
- Rate-limit API `/api/vulnerable` + IP allowlist สำหรับ admin

### 3.6 ด้าน Performance
- Server Components ของ Next.js render stats ก่อน hydrate
- ใช้ `@vis.gl/react-maplibre` หรือ `react-map-gl` (peer dep maplibre-gl)
- Memoize layer source ด้วย stable URL (ETag) ให้ browser cache
- Edge runtime สำหรับ `/api/flood-points` (data ไม่ sensitive)

### 3.7 ด้าน Observability
- Sentry สำหรับ error tracking ฝั่ง client+server
- Vercel Analytics / PostHog ดู funnel การใช้งานเจ้าหน้าที่
- DB query log สำหรับ slow spatial query (> 100ms)

---

## 4. Quick-win (1 สัปดาห์แรก เริ่มได้เลย)

1. แปลง prototype เป็น React component ใน [src/app/map/page.tsx](src/app/map/page.tsx) ด้วย `dynamic(() => import('@/components/FloodMap'), { ssr:false })`
2. ย้าย FLOOD_POINTS และ S2 GeoJSON ออกไปไว้ใน `/public/data/*.json` แล้ว `fetch()` แบบ lazy ใน `useEffect`
3. แตก component: `<MapView>`, `<Sidebar>`, `<LayerToggle>`, `<VulnerableList>` (props-driven)
4. ใส่ TypeScript types: `FloodPoint`, `VulnerablePerson`, `Infrastructure`, `RiskLevel`
5. เพิ่ม `tailwindcss` แทน inline CSS (เดิมมี CSS variables อยู่แล้ว map เข้า theme ได้ง่าย)
6. แก้ `nearFlood()` ให้ใช้ haversine จริง + memoize

หลังจากนี้ค่อย incremental ใส่ DB / Auth / API ตาม roadmap

---

## 5. สรุปสั้น

Prototype เดิมเป็น HTML demo ที่ดีพอจะ pitch ให้ stakeholder ดู แต่ขาด 4 เสาหลักของระบบจริง: **(1) ฐานข้อมูล spatial**, **(2) auth + PDPA**, **(3) data ingestion อัตโนมัติ**, และ **(4) routing ที่หลบน้ำได้จริง** การยกขึ้น Next.js ควรเริ่มจาก quick-win (แตกเป็น components + dynamic import) ก่อนแล้วค่อยทยอยใส่ Postgres+PostGIS, NextAuth, แล้วต่อด้วย MapLibre + OSRM ในเฟสถัดไป
