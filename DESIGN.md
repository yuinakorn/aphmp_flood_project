# DESIGN.md — ระบบภูมิสารสนเทศสุขภาพระดับหน้าด่าน

> v1.1 (updated 2026-05-31) · north star = `docs/new/health_gis_emergency_dashboard.html`
> เอกสารเดิม archive ที่ `DESIGN.legacy.md` (ทิศทาง austere/dark-first — ถูกแทนที่)
> Implementation: Tailwind v4 + shadcn/ui + token ใน `src/app/globals.css` + ชุดคลาส `gx-*`

## Theme

**สว่างเป็นหลัก + มีโหมดมืด.** ค่า default = light (พื้น slate อ่อน, การ์ดขาว) เพื่อใช้กลางวันในสำนักงาน รพ.สต. โหมดมืดให้สลับได้สำหรับศูนย์สั่งการกลางคืน. token ชุดเดียว สลับค่าใน `:root` ↔ `.dark` ผ่าน `next-themes`.

## Color (OKLCH, semantic-first)

สีถูกผูกกับ "ความหมาย" เสมอ ไม่ใช้ตกแต่ง. neutrals มี cool-slate tint (hue ~245) เบาๆ.

### Surfaces & text

| Token | บทบาท |
| --- | --- |
| `bg` / `bg-sunken` | พื้นแอป / พื้นยุบ (พื้นหลังการ์ดซ้อน, input) |
| `bg-elevated` | การ์ด, panel, popover (ยกด้วยเงา) |
| `border` / `border-strong` | เส้นคั่น / ขอบเน้น (focus, selected) |
| `fg` / `fg-muted` / `fg-subtle` | ข้อความหลัก / รอง / ตติยภูมิ |

### Status — ภาษาสีของระบบ

| Token | สี | ความหมาย |
| --- | --- | --- |
| `risk-flood` / critical | แดง | วิกฤต, ในเขตน้ำท่วม, ต้องการช่วยด่วน (Triage แดง) |
| `risk-near` / watch | ส้ม-เหลือง (amber) | เฝ้าระวัง, เริ่มกระทบ (Triage เหลือง) |
| `risk-safe` / safe | เขียว (emerald) | ปลอดภัย, ปกติ (Triage เขียว) |
| `evacuated` | น้ำเงิน | อพยพแล้ว / พำนักชั่วคราว |
| `signal-data` / info | ฟ้า-เขียว | ข้อมูล/โทรมาตร/คำแนะนำระบบ |
| `infra` | คราม/ม่วง | โครงสร้างพื้นฐาน (ศูนย์พักพิง, ครัว, จุดจอดเรือ) — ที่เดียวที่ใช้ม่วง |

**วินัย**: สีสถานะปรากฏเฉพาะบนข้อมูลที่มีสถานะนั้น ไม่ทาบน chrome (ไม่มีติ๊กเขียวบน header, ไม่มีขอบแดงรอบ panel เฉยๆ)

### Category accents (icon tiles)

6 เฉดสำหรับ color-code หมวดงานบน dashboard/เมนู (folder/roster/infra/water/map/api) — ดู `--cat-*` ใน globals.css

### Mode theming

- **Normal** — surface ปกติ, accent ฟ้า
- **Crisis** — เปิดแถบประกาศภัยสีแดง (ไล่เฉดได้แต่ห้ามบนตัวอักษร), badge สถานะ incident เป็นแดง, live dot pulse. ไม่เปลี่ยนพื้นทั้งจอเป็นแดง — ความเร่งด่วนมาจากแถบ+ตำแหน่ง+น้ำหนัก

## Typography

- **Sans**: IBM Plex Sans Thai (ครอบคลุมไทย+Latin ความสูงตัวอักษรเท่ากัน) — เป็นฟอนต์ทางการของระบบ (ไม่ใช้ Noto Sans Thai ของ mockup)
- **Mono**: JetBrains Mono — เฉพาะ พิกัด, จำนวน, เวลา, ID

### Scale (ปรับใหญ่ขึ้นแล้วใน globals.css — แก้ปัญหา "ตัวเล็ก")

| Utility | px | ใช้ |
| --- | --- | --- |
| `text-xs` | 13 | pill, metadata, caption |
| `text-sm` | 14 | body, table cell, input |
| `text-base` | 15 | อ่านปกติ, label section |
| `text-lg` | 17 | subhead |
| `text-xl` | 22 | หัวข้อย่อย, ตัวเลขเด่น |
| `text-2xl` | 28 | page title |
| `text-3xl` | 34 | hero / dashboard title |

น้ำหนัก: ตัวเลข mono 600, body ไทย 400, label 500-600 + uppercase tracked

## Spacing & Radius & Elevation

- **Spacing**: scale 4px base (1,2,3,4,6,8,12,16,24,32,48,64...) — ทุกค่ามาจาก scale เดียว
- **Radius**: sm 5 / md 8 / lg 12 / xl 16 — การ์ดใช้ `lg`-`xl` (โค้งกว่าเดิมเพื่อความ modern)
- **Elevation**: เงานุ่ม 3 ระดับ `--shadow-sm/md/lg` — การ์ดยกด้วยเงา ไม่ใช่แค่เส้นขอบ (แก้ความ "แบน"). hover การ์ด interactive ยกตัว -2px + เงาเพิ่ม

## Component library (`gx-*` + shadcn)

สร้างบน shadcn primitives; คลาส `gx-*` ใน globals.css เป็น layer ความหมาย

| Component | คลาส/ที่มา | หมายเหตุ |
| --- | --- | --- |
| Surface card | `.gx-card` (+`.gx-card-interactive`) | การ์ดมาตรฐาน — ใช้กับเนื้อหาแยกชิ้น **ห้ามซ้อนการ์ดในการ์ด** |
| Status ribbon | flex bar + `divide-x` + ตัวเลข mono 24-28px | **แทน stat card grid** บนหน้า ops/dashboard — ตัวเลขเป็น typography ไม่ใช่กล่อง (PRODUCT หลัก 4) |
| Worklist row | flex row + leading status (จุด+คำสั้น สีตามความเร่งด่วน) | แถวรายการ triage หนาแน่น: status / identity / context / equipment tag / inline actions. ทั้งแถวกดเลือกได้, hover tint, selected = `accent/8%` bg |
| Segmented control | pill ใน track `bg-sunken` + active = `bg-elevated` shadow-sm | **ใช้แทน tab-in-card** บนหน้า ops; เหมาะกับ 2-4 หมวด พร้อม count chip |
| Icon tile | `.gx-icon-tile` (`--tile` hue) | ไอคอนสีตามหมวด (ใช้บนหน้า launcher; หลีกเลี่ยงบนหน้า ops) |
| Status badge | `.gx-badge` + `-flood/-near/-safe/-info` | พื้นสีจาง + จุด + ข้อความ |
| Button | `.gx-btn` + `-primary/-ghost/-sm` | |
| Data table | `.gx-table` | header sticky, row hover, badge ในเซลล์ |
| Crisis banner | `.gx-banner-crisis` | แถบโหมดวิกฤต |
| Note strip | `.gx-note` | คำแนะนำ/PDPA |
| Tabs (shadcn) | border-b active | เก็บไว้สำหรับหน้าฟอร์ม/settings; ห้ามใช้บนหน้า ops |
| Modal / Sheet | shadcn Dialog/Sheet | desktop = Dialog กลางจอ, mobile = Sheet ล่าง |
| Role switcher | shadcn Dropdown + view-as | บน Masthead (`RoleViewProvider`) |
| Mode toggle | ปุ่มคู่ Normal/Crisis | บน header ของหน้า ops (ยังไม่ลง Masthead) |

## Layout

- **EOC Dashboard** — **worklist-led**: grid 12 คอลัมน์, **main 8** (segmented control + worklist หนาแน่น), **rail 4** (Leaflet map sticky + selected-person detail). Status ribbon เต็มความกว้างเหนือ grid. ไม่มี card grid ของ stats. `max-w-7xl` กลางจอ
- **Masthead** — header เข้ม slate-900: โลโก้ tile emerald + ชื่อระบบ (ไทยใหญ่ + อังกฤษเล็ก) ซ้าย; role switcher (view-as) ขวา
- **หน้า admin เชิงลึก** (vulnerable, family-folder, infra, etc.) — header (eyebrow + `gx-title` + ปุ่ม primary) + เนื้อหาในการ์ดเดียว ห้ามซ้อนการ์ด

## Pattern: Operations console (สำหรับหน้า ops / triage)

หน้าที่ "operator ต้องตัดสินใจตอนนี้" — EOC dashboard เป็นต้นแบบ. ใช้ pattern นี้กับหน้าที่มีลักษณะเดียวกัน (เช่น หน้าสั่งการคำร้องในอนาคต)

**Anchor references**: Linear (worklist density, keyboard-first), incident.io / Datadog incident view (severity-sorted, status ribbon), กระดาน triage รพ.

**กฎ**:
1. **Status ribbon ไม่ใช่ stat cards** — ตัวเลขเป็น typography mono ใหญ่ คั่นด้วยเส้น ไม่ใส่กล่อง
2. **Worklist เป็นพระเอก** — รายการที่ต้องลงมือ กินพื้นที่หลัก เรียง**ตามความเร่งด่วนเสมอ** (flood→near→safe, critical→high→normal)
3. **แต่ละแถวจบที่ action** — ปุ่มสั่งการ inline (เยี่ยม/ขอช่วย/จัดทีม) ไม่ต้องเปิด modal หาปุ่ม
4. **แผนที่เป็น rail context** — เลือกแถว ↔ ไฮไลต์หมุด, คลิกหมุด ↔ เลือกแถว
5. **ใต้แผนที่ = detail ของคนที่เลือก** — ภาวะ + **อุปกรณ์พยุงชีพ** (สำคัญสุดต่อการอพยพ — tag สีแดง) + ปุ่ม action
6. **โหมดวิกฤต**: banner + ปุ่ม mode แดง + live ping dot บน incident name. ไม่เปลี่ยนพื้นทั้งจอเป็นแดง

## Map aesthetics

- **Stack**: `react-leaflet` (เบา, declarative) สำหรับ map ในการ์ด/rail; FloodMap ตัวใหญ่ของ `/map` ยังใช้ Leaflet imperative เดิม. dynamic import + `ssr:false` เสมอ
- **Basemap**: CARTO Positron (`light_all`) เป็น default สำหรับธีมสว่าง — สะอาด ไม่กลบหมุด. ดาร์กธีมค่อยสลับ `dark_all` ภายหลัง
- หมุดกลุ่มเปราะบาง: `CircleMarker` สีตามความเสี่ยง (`fillColor` risk-token) + stroke ขาว 1.5px; เลือก → stroke `accent` หนา 3px + radius ใหญ่ขึ้น. **ไม่ใช้ emoji** เป็นหมุด
- โครงสร้างพื้นฐาน: ไอคอน Lucide สีคราม/ม่วง (infra-medical/shelter) ในกล่องโค้ง
- overlay น้ำท่วม (FloodMap จริง): ไล่เฉด amber→ส้ม→แดง→ม่วงเข้ม ตามความรุนแรง (ไม่ใช้ rainbow)
- popup: tooltip บางๆ บน hover; รายละเอียดเต็มไปอยู่ใน "selected detail card" ใต้แผนที่ใน rail ไม่ใช่ popup ลอยบนแผนที่

## Motion

- transition มาตรฐาน `cubic-bezier(0.22, 1, 0.36, 1)` ~180ms
- live/crisis: pulse opacity 0.55→1 (2.4s) — ไม่กะพริบ
- หมุดวิกฤตเด้งเบาๆ ได้ในโหมดวิกฤต; reduced-motion → opacity เท่านั้น
- modal/sheet เข้าด้วย transform + fade

## Icons

**Lucide** stroke 1.5–1.75; 16px พื้นที่หนาแน่น, 18–22px ใน tile/หัวข้อ. **ห้าม emoji เป็นไอคอน** (อนุญาตเฉพาะใน content ที่ผู้ใช้พิมพ์เอง)

## สถานะการ implement

**เสร็จแล้ว:**
- ✅ token (สี/เงา/type scale/category) + คลาส `gx-*` ใน globals.css
- ✅ หน้า `/admin` launcher + `/admin/vulnerable` แปลงเป็น gx-system
- ✅ Masthead: header เข้ม slate-900 + `RoleViewProvider` (view-as preview) + logout
- ✅ **`/admin/eoc` — operations console**: status ribbon, worklist-led 3 segment, Leaflet map rail
  - Geo drill: อำเภอ→ตำบล→หมู่บ้าน→รายชื่อ พร้อม breadcrumb + reset
  - 3 view-mode: การ์ด / ตาราง·เร่งด่วน (flood/near/safe) / ตาราง·ประเภท (ติดเตียง/พิการ/สูงอายุ/ตั้งครรภ์)
  - **โหมดปกติ**: coverage view รายหมู่บ้าน (% เยี่ยมใน 90 วัน + วันเยี่ยมล่าสุด)
  - **Incident Scope**: ribbon/tables/map filter ตาม incident ที่เลือก
- ✅ schema เฟส B: `rescue_teams`, `health_visits` (vital/mental/mcat), API `/api/rescue-teams`
- ✅ restyle `/admin/incidents` + ปุ่ม "จัดการเหตุการณ์นี้" → set scope + เด้งไป EOC
- ✅ restyle `/admin/infra`, `/admin/water-level`, `/admin/family-folder`
- ✅ **`/admin/shelters` + `[id]`** (เฟส D): intake modal, zone data-driven, PDPA mask, action inline
- ✅ **Phase G — Incident Scope** (migration 0017–0018):
  - `IncidentScopeProvider` + cookie `gx-incident-id` (httpOnly, 30 วัน)
  - `IncidentSwitcher` dropdown บน Masthead (สีแดงเมื่อ active)
  - `IncidentBanner` sticky ใต้ Masthead (แดง/เหลือง/เทาตาม status)
  - EOC/shelters/rescue/requests/admissions ทุกตัว scope ตาม incident
  - `shelter_admissions.incident_id` FK + 5 indexes (incident_id บนทุกตารางปฏิบัติการ)
  - Server-side validation ใน `getActiveIncident()` — ไม่เชื่อ cookie อย่างเดียว

**ยังไม่ทำ:**
- ⬜ map surface `/map` (FloodMap, popup, Rail/StatusStrip) — restyle
- ⬜ FieldActionSheet (ฟอร์มเยี่ยม/คำร้อง) — restyle
- ⬜ MCAT screen + Triage UI ใน health visit form (schema พร้อมแล้ว)
- ⬜ Phase E: operations counters + surveillance (สำหรับ Sit Rep)
- ⬜ Phase F: Situation Report page (hybrid auto-aggregate + manual)

---

## แผนการปรับปรุงดีไซน์สู่ความทันสมัย (UI/UX Redesign & Modernization Plan)

เรากำลังทยอยปรับปรุงหน้าจอต่างๆ ของระบบให้มีความทันสมัย สวยงาม ดูเป็นมิตร (Friendly) และลดภาระทางความคิด (Cognitive Load) โดยยึดหลักการสร้างความอุ่นใจและให้ความช่วยเหลือผู้ประสบภัยอย่างเร่งด่วน

### 1. ปรัชญาการดีไซน์ใหม่ (Redesign Philosophy)
- **Visual Split Screen**: บนจอขนาดใหญ่ (Desktop) แบ่งฝั่งข้อมูลและฝั่งฟอร์ม/แผนที่ให้ชัดเจน โดยใช้ภาพประกอบการ์ตูน Vector ร่วมกับ CSS Keyframe อนิเมชันเพื่อสร้างความรู้สึกเคลื่อนไหวและเป็นมิตร
- **Progressive Wizard Flow**: แบ่งแบบฟอร์มยาวๆ ออกเป็นขั้นตอนย่อยๆ (Step-by-step) เพื่อลดความล้นหลามของข้อมูล (Data overload) ขณะเกิดวิกฤต
- **Dynamic Field Feedback**: แสดงความถูกต้องของข้อมูล (เช่น เบอร์โทรศัพท์) ทันทีในขณะพิมพ์ด้วยสัญลักษณ์สีสันที่เข้าใจง่าย
- **Ink-Saving Print Media**: สื่อสัญลักษณ์สำหรับดาวน์โหลด/พิมพ์ (Poster/Roster) ต้องปรับการตั้งค่า CSS Print (`@page`) แยกตามการใช้งานจริง (เช่น โปสเตอร์แนวตั้ง A4) และล้างสีพื้นหลังออกเพื่อไม่ให้เปลืองหมึกพิมพ์

### 2. ส่วนที่ปรับปรุงแล้ว (Implemented)
- **✅ หน้าแจ้งคำร้องสาธารณะ (`/report`)**:
  - ใช้ Split Layout (ซ้าย: ภาพประกอบการ์ตูนกู้ภัยลอยตัวเบาๆ + คลื่นน้ำขยับได้ + การ์ดเบอร์โทรฉุกเฉิน, ขวา: ฟอร์มคำร้องแบบการ์ดลอยเงาซอฟต์)
  - ปรับเป็นแบบฟอร์ม 3 ขั้นตอนย่อย (ประเภทความช่วยเหลือ → เบอร์ติดต่อและรายละเอียด → ตำแหน่งและแผนที่ปักหมุด)
  - เพิ่มระบบ Auto-advance เมื่อกดเลือกประเภทช่วยเหลือในขั้นตอนแรก และระบบ Validate เบอร์โทรเรียลไทม์
  - ออกแบบหน้าแสดงความสำเร็จให้อยู่ภายใต้เฟรมการ์ดเดิมแบบไร้รอยต่อ
- **✅ หน้าพิมพ์สื่อโปสเตอร์ประชาสัมพันธ์ (`/report/poster`)**:
  - ปรับปรุงเลย์เอาต์ A4 แนวตั้งใหม่ทั้งหมด เพิ่มโลโก้กระทรวงสาธารณสุขและ FloodWatch ด้านบนสุดเพื่อความน่าเชื่อถือ
  - วางข้อมูลแบบ 2 คอลัมน์ (ภาพประกอบข้อดีระบบคู่กับคิวอาร์โค้ดขนาดใหญ่พร้อมลิงก์ย่อ)
  - เขียน CSS Print Override ให้บังคับพิมพ์แบบ A4 แนวตั้ง (Portrait) ด้วยระยะขอบที่พอดีบนหน้าเดียว ไม่ล้นไปหน้าที่สอง

### 3. แผนการทยอยปรับปรุงในลำดับถัดไป (Future Redesign Roadmap)
- **⬜ หน้าแผนที่ประชาชนและ EOC (`/map` & `/admin/eoc`)**:
  - ทยอยปรับสีสันโทนแอปและหมุดแผนที่ให้ตรงตามมาตรฐาน OKLCH สว่าง/มืด
  - ปรับปรุงแถบควบคุมและกล่องข้อมูล (Popup) ของผู้ประสบภัยให้โค้งมนเรียบร้อย และเปลี่ยน Sidebar บนมือถือเป็น Bottom Sheet (ใช้ `vaul` หรือเทียบเท่า)
- **⬜ หน้าต่างฟอร์มเยี่ยมบ้าน/คำร้องของเจ้าหน้าที่ (FieldActionSheet)**:
  - ปรับดีไซน์ฟอร์มยาวให้เป็นการ์ดแบ่งสเต็ปคล้ายฟอร์มแจ้งเหตุสาธารณะ
  - เพิ่มไอคอนและสัญลักษณ์ประเมินระดับความรุนแรง (Triage สี แดง/เหลือง/เขียว) ให้เห็นเด่นชัด
- **⬜ หน้าต่าง MCAT (Mental Health Screen & Triage)**:
  - ใช้การจัดวางแบบการ์ดประเมินสภาวะอารมณ์/ระดับจิตใจแบบไอคอนสื่อความหมาย แทนฟอร์มคำถามแบบดั้งเดิม เพื่อลดความตึงเครียดของประชาชนระหว่างการประเมิน

