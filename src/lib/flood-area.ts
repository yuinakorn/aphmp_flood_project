/** จุดกึ่งกลางของพื้นที่น้ำท่วม (จาก flood-points) — ใช้ตั้งค่าเริ่มต้นแผนที่ปักพิกัด */
import floodPointsData from '../../public/data/flood-points.json'

const pts: [number, number][] = floodPointsData.features.map((f) => [
  f.geometry.coordinates[1],
  f.geometry.coordinates[0],
])

export const FLOOD_CENTROID = pts.length
  ? {
      lat: pts.reduce((s, p) => s + p[0], 0) / pts.length,
      lng: pts.reduce((s, p) => s + p[1], 0) / pts.length,
    }
  : { lat: 20.43, lng: 99.88 } // fallback: แม่สาย
