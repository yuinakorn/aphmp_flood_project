import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "https://watercenter.scmc.cmu.ac.th/cmflood/getDataSurveyLevelVer1/";

const AREA_COLORS = {
  "บ้าน": { bg: "#E6F1FB", text: "#0C447C" },
  "ถนน": { bg: "#EAF3DE", text: "#3B6D11" },
  "พื้นที่การเกษตร": { bg: "#FAEEDA", text: "#633806" },
  "สถานที่": { bg: "#FBEAF0", text: "#72243E" },
  "อื่นๆ": { bg: "#F1EFE8", text: "#444441" },
};

const getAreaColor = (area) => AREA_COLORS[area] || AREA_COLORS["อื่นๆ"];

const getWaterColor = (level) => {
  if (level >= 80) return "#E24B4A";
  if (level >= 50) return "#EF9F27";
  if (level >= 30) return "#378ADD";
  return "#1D9E75";
};

export default function FloodMarkersApp() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, done: false });
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [sortBy, setSortBy] = useState("code");
  const [page, setPage] = useState(1);
  const abortRef = useRef(false);
  const ROWS_PER_PAGE = 100;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAllData([]);
    abortRef.current = false;
    let pageNum = 1;
    let collected = [];
    let total = 0;

    try {
      while (!abortRef.current) {
        const res = await fetch(`${API_BASE}${pageNum}`);
        if (!res.ok) break;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;
        collected = [...collected, ...data];
        total = collected.length;
        setProgress({ current: pageNum, total, done: false });
        setAllData([...collected]);
        pageNum++;
        // safety: stop after 200 pages
        if (pageNum > 200) break;
        await new Promise(r => setTimeout(r, 80));
      }
    } catch (e) {
      setError(e.message);
    }

    setProgress(p => ({ ...p, done: true }));
    setLoading(false);
  }, []);

  const stopFetch = () => { abortRef.current = true; };

  const filtered = allData.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      d.code?.toLowerCase().includes(q) ||
      d.place_detail?.toLowerCase().includes(q) ||
      d.tool?.toLowerCase().includes(q) ||
      d.place_around?.toLowerCase().includes(q);
    const matchArea = !areaFilter || d.affected_area === areaFilter;
    return matchSearch && matchArea;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "code") return a.code?.localeCompare(b.code);
    if (sortBy === "water_desc") return (b.water_level || 0) - (a.water_level || 0);
    if (sortBy === "water_asc") return (a.water_level || 0) - (b.water_level || 0);
    if (sortBy === "date") return (b.date_survey || "").localeCompare(a.date_survey || "");
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const pageData = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const areaTypes = [...new Set(allData.map(d => d.affected_area).filter(Boolean))];

  const stats = {
    total: allData.length,
    maxFlood: allData.length ? Math.max(...allData.map(d => d.water_level || 0)) : 0,
    avgFlood: allData.length ? Math.round(allData.reduce((s, d) => s + (d.water_level || 0), 0) / allData.length) : 0,
    areas: [...new Set(allData.map(d => d.affected_area).filter(Boolean))].length,
  };

  const downloadCSV = () => {
    const header = ["code","date_survey","affected_area","place_detail","place_around","water_level","tool","latitude","longitude"];
    const rows = allData.map(d => header.map(k => JSON.stringify(d[k] ?? "")).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "flood24_markers.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "1rem 0", fontFamily: "var(--font-sans)", color: "var(--color-text-primary)" }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 1rem" }}>
        CM Flood Mark 2024 — เครื่องหมายระดับน้ำท่วม
      </h2>

      {/* Fetch controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
        <button
          onClick={fetchAll}
          disabled={loading}
          style={{
            padding: "8px 18px", fontSize: 13, borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-secondary)", background: loading ? "var(--color-background-secondary)" : "var(--color-background-primary)",
            cursor: loading ? "not-allowed" : "pointer", color: "var(--color-text-primary)"
          }}
        >
          {loading ? "⏳ กำลังดึงข้อมูล..." : allData.length > 0 ? "🔄 ดึงข้อมูลใหม่" : "📥 ดึงข้อมูลทั้งหมด"}
        </button>
        {loading && (
          <button onClick={stopFetch} style={{ padding: "8px 14px", fontSize: 13, borderRadius: "var(--border-radius-md)", border: "0.5px solid #E24B4A", color: "#A32D2D", background: "var(--color-background-primary)", cursor: "pointer" }}>
            ⏹ หยุด
          </button>
        )}
        {allData.length > 0 && (
          <button onClick={downloadCSV} style={{ padding: "8px 14px", fontSize: 13, borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", cursor: "pointer", color: "var(--color-text-primary)" }}>
            ⬇️ CSV
          </button>
        )}
        {loading && (
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            หน้าที่ {progress.current} · โหลดแล้ว {progress.total.toLocaleString()} จุด
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: "#FCEBEB", border: "0.5px solid #F09595", borderRadius: "var(--border-radius-md)", padding: "10px 14px", marginBottom: "1rem", fontSize: 13, color: "#791F1F" }}>
          ⚠️ Error: {error}
        </div>
      )}

      {/* Progress bar */}
      {loading && (
        <div style={{ height: 4, background: "var(--color-background-secondary)", borderRadius: 2, marginBottom: "1.25rem", overflow: "hidden" }}>
          <div style={{ height: 4, background: "#378ADD", borderRadius: 2, width: `${Math.min(100, (progress.current / 100) * 100)}%`, transition: "width 0.3s" }} />
        </div>
      )}

      {/* Stats */}
      {allData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: "1.25rem" }}>
          {[
            { label: "จุดทั้งหมด", val: stats.total.toLocaleString(), color: "#185FA5" },
            { label: "สูงสุด (ซม.)", val: stats.maxFlood, color: "#A32D2D" },
            { label: "เฉลี่ย (ซม.)", val: stats.avgFlood, color: "#854F0B" },
            { label: "ประเภทพื้นที่", val: stats.areas, color: "#3B6D11" },
            { label: "ผลลัพธ์กรอง", val: filtered.length.toLocaleString(), color: "#533AB7" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px" }}>
              <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {allData.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="ค้นหา รหัส / สถานที่ / โครงสร้าง..."
            style={{ flex: 1, minWidth: 200, height: 34, padding: "0 10px", fontSize: 13, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          />
          <select
            value={areaFilter}
            onChange={e => { setAreaFilter(e.target.value); setPage(1); }}
            style={{ height: 34, padding: "0 10px", fontSize: 13, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          >
            <option value="">ทุกประเภท</option>
            {areaTypes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(1); }}
            style={{ height: 34, padding: "0 10px", fontSize: 13, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          >
            <option value="code">เรียง: รหัส</option>
            <option value="water_desc">น้ำมาก→น้อย</option>
            <option value="water_asc">น้ำน้อย→มาก</option>
            <option value="date">วันที่สำรวจ</option>
          </select>
        </div>
      )}

      {/* Table */}
      {allData.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary)", fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌊</div>
          กดปุ่ม "ดึงข้อมูลทั้งหมด" เพื่อโหลด Flood Marks จาก API
        </div>
      )}

      {pageData.length > 0 && (
        <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 100 }} /><col style={{ width: 70 }} /><col style={{ width: 70 }} />
              <col style={{ width: 220 }} /><col style={{ width: 110 }} /><col style={{ width: 80 }} />
              <col style={{ width: 60 }} />
            </colgroup>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["รหัส","วันที่","ประเภท","สถานที่","โครงสร้าง","น้ำท่วม (ซม.)","พิกัด"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-secondary)", position: "sticky", top: 0, zIndex: 1, background: "var(--color-background-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((d, i) => {
                const ac = getAreaColor(d.affected_area);
                const wc = getWaterColor(d.water_level);
                return (
                  <tr key={d.code + i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}
                  >
                    <td style={{ padding: "7px 10px", fontWeight: 500, fontSize: 12 }}>
                      <a href={`https://watercenter.scmc.cmu.ac.th/cmflood/flood24/report/${d.code}`}
                         target="_blank" rel="noopener"
                         style={{ color: "var(--color-text-info)", textDecoration: "none" }}>
                        {d.code}
                      </a>
                    </td>
                    <td style={{ padding: "7px 10px", color: "var(--color-text-secondary)", fontSize: 11 }}>{d.date_survey || "-"}</td>
                    <td style={{ padding: "7px 10px" }}>
                      {d.affected_area && (
                        <span style={{ background: ac.bg, color: ac.text, fontSize: 10, padding: "2px 6px", borderRadius: 10, fontWeight: 500, whiteSpace: "nowrap" }}>
                          {d.affected_area}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "7px 10px", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }} title={d.place_detail}>
                      {d.place_detail || "-"}
                    </td>
                    <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.tool || "-"}
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--color-background-secondary)", borderRadius: 3 }}>
                          <div style={{ height: 6, borderRadius: 3, background: wc, width: `${Math.min(100, (d.water_level / 150) * 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: wc, minWidth: 28, textAlign: "right" }}>{d.water_level}</span>
                      </div>
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      {d.latitude && d.longitude ? (
                        <a href={`https://maps.google.com/?q=${d.latitude},${d.longitude}`} target="_blank" rel="noopener"
                           style={{ fontSize: 10, color: "var(--color-text-info)", textDecoration: "none" }}>
                          📍 แผนที่
                        </a>
                      ) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "1rem", flexWrap: "wrap" }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "5px 10px", fontSize: 12, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", cursor: page === 1 ? "not-allowed" : "pointer", color: "var(--color-text-primary)" }}>«</button>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ padding: "5px 10px", fontSize: 12, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", cursor: page === 1 ? "not-allowed" : "pointer", color: "var(--color-text-primary)" }}>‹</button>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>หน้า {page} / {totalPages} ({sorted.length.toLocaleString()} รายการ)</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} style={{ padding: "5px 10px", fontSize: 12, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", cursor: page === totalPages ? "not-allowed" : "pointer", color: "var(--color-text-primary)" }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "5px 10px", fontSize: 12, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", background: "var(--color-background-primary)", cursor: page === totalPages ? "not-allowed" : "pointer", color: "var(--color-text-primary)" }}>»</button>
        </div>
      )}

      {progress.done && allData.length > 0 && (
        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: "0.75rem" }}>
          ✅ โหลดครบ {allData.length.toLocaleString()} จุด จาก {progress.current} หน้า API
        </p>
      )}
    </div>
  );
}
