# FloodWatch

ระบบติดตามน้ำท่วม ด้วยข้อมูล Sentinel-1/2 SAR และ GISTDA เป็นระบบที่สร้างขึ้นเพื่อเฝ้าระวังและแจ้งเตือนกลุ่มเปราะบางก่อนเหตุการณ์น้ำหลาก พร้อมแสดงจุดเสี่ยง สถานที่ปลอดภัย และเส้นทางการอพยพไปยังศูนย์พักพิง

## ภาพหน้าจอการทำงานของระบบ (Screenshots)

### 1. หน้าจอแผนที่ติดตามน้ำท่วม
![Map View 1](./public/screen_short/Screenshot%202569-05-12%20at%2000.00.52.png)

### 2. ข้อมูลกลุ่มเปราะบางและระดับความเสี่ยง
![Map View 2](./public/screen_short/Screenshot%202569-05-12%20at%2000.00.55.png)

### 3. การแสดงผลเส้นทางอพยพ
![Map View 3](./public/screen_short/Screenshot%202569-05-12%20at%2000.01.03.png)

### 4. การจัดการ Layer / พื้นหลังแผนที่ Google Maps
![Map View 4](./public/screen_short/Screenshot%202569-05-12%20at%2000.01.46.png)

### 5. ข้อมูลสถานที่ / ศูนย์รวมพล
![Map View 5](./public/screen_short/Screenshot%202569-05-12%20at%2000.01.33.png)

## การติดตั้งและใช้งานระบบ (Getting Started)

1. ทำการติดตั้งแพ็กเกจที่จำเป็น
```bash
npm install
```

2. คัดลอกและสร้างไฟล์ Environment (ถ้ามี)
```bash
cp .env.local.example .env.local
```

3. รันเซิร์ฟเวอร์ในโหมด Development
```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000) เพื่อใช้งานระบบ
