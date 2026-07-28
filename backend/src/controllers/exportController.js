const { pool } = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// ── Helper: format time ───────────────────────────────────────────────────────
const fmtTime = (dt) => {
  if (!dt) return '-';
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const fmtDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};
const statusLabel = (s) => ({ present:'Hadir', late:'Terlambat', absent:'Tidak Hadir', leave:'Cuti', sick:'Sakit' }[s] || s);
const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const fmtRupiah = (n) => `Rp ${n.toLocaleString('id-ID')}`;

// ── Helper: kop laporan PDF seragam ────────────────────────────────────────────
const drawReportHeader = (doc, { companyName, reportTitle, periodLabel, printedBy }) => {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.fontSize(17).font('Helvetica-Bold').fillColor('#0F172A').text(companyName, left, doc.y, { align: 'center' });
  doc.fontSize(11).font('Helvetica').fillColor('#334155').text(reportTitle, { align: 'center' });
  doc.y += 8;

  // Garis ganda: tebal lalu tipis
  doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1.5).strokeColor('#1E293B').stroke();
  doc.y += 2.5;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.5).strokeColor('#94A3B8').stroke();
  doc.lineWidth(1);
  doc.y += 8;

  doc.fontSize(8).font('Helvetica').fillColor('#64748B')
    .text(`Periode: ${periodLabel}`, left, doc.y, { continued: true })
    .text(`   •   Dicetak oleh: ${printedBy}   •   ${new Date().toLocaleString('id-ID')}`, { align: 'right' });
  doc.y += 12;
};

// ── Helper: footer nomor halaman PDF (dipanggil setelah semua halaman selesai) ─
const drawPdfFooters = (doc) => {
  const range = doc.bufferedPageRange();
  const savedBottom = doc.page.margins.bottom;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // cegah auto page-break saat menulis di area footer
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const y = doc.page.height - savedBottom - 8;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor('#94A3B8')
      .text(`Halaman ${i - range.start + 1} dari ${range.count}`, left, y + 3, { width: right - left, align: 'center', lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
};

// ── Helper: judul & header row Excel seragam ───────────────────────────────────
const styleExcelTitle = (ws, colCount, text) => {
  ws.mergeCells(1, 1, 1, colCount);
  const cell = ws.getCell(1, 1);
  cell.value = text;
  cell.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(1).height = 26;
};

const styleExcelHeaderRow = (row) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  row.height = 20;
  row.eachCell(cell => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });
};

const borderThinCell = (cell) => {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };
};

// ── Helper: ambil jam mulai kerja & toleransi dari app_settings ───────────────
const getWorkStartSettings = async () => {
  const [rows] = await pool.query(
    "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('work_start_time','late_tolerance')"
  );
  const map = Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value]));
  return {
    workStart: map.work_start_time || '08:00',
    tolerance: parseInt(map.late_tolerance || '15'),
  };
};

// ── Helper: hitung denda keterlambatan berjenjang ─────────────────────────────
// Menit ke-1 s/d `tolerance` = gratis. Setelah itu, tiap blok 10 menit tambahan dikenakan Rp10.000 x nomor blok.
// Status selain 'late' (mis. 'present' karena izin terlambat disetujui) tidak dikenakan denda.
const calcLateFine = (checkIn, date, workStart, tolerance, status) => {
  if (!checkIn) return 0;
  if (status !== 'late') return 0;
  const [startH, startM] = workStart.split(':').map(Number);
  const checkInDt = new Date(checkIn);
  const scheduledDt = new Date(checkIn);
  scheduledDt.setHours(startH, startM, 0, 0);

  const lateMinutes = Math.round((checkInDt - scheduledDt) / 60000) - tolerance;
  if (lateMinutes <= 0) return 0;

  const block = Math.ceil(lateMinutes / 10);
  return block * 10000;
};

// ── Helper: bangun filter tanggal (range atau bulan/tahun) ────────────────────
const buildDateFilter = (query, tableAlias = 'a', dateCol = 'date') => {
  const { start_date, end_date, month, year } = query;
  const col = `${tableAlias}.${dateCol}`;
  if (start_date && end_date) {
    return {
      filter: `AND ${col} >= ? AND ${col} <= ?`,
      params: [start_date, end_date],
      label: `${start_date} s/d ${end_date}`,
      fileTag: `${start_date}_${end_date}`,
    };
  }
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year)  || new Date().getFullYear();
  return {
    filter: `AND MONTH(${col}) = ? AND YEAR(${col}) = ?`,
    params: [m, y],
    label: `${months[m-1]} ${y}`,
    fileTag: `${m}_${y}`,
    m, y,
  };
};

// ── EXPORT REKAP ABSENSI EXCEL ────────────────────────────────────────────────
const exportAttendanceExcel = async (req, res) => {
  try {
    const { filter, params, label, fileTag } = buildDateFilter(req.query);
    const { workStart, tolerance } = await getWorkStartSettings();

    const [report] = await pool.query(
      `SELECT u.name, u.employee_id, u.department, u.position,
        COUNT(CASE WHEN a.status='present' THEN 1 END) as hadir,
        COUNT(CASE WHEN a.status='late'    THEN 1 END) as terlambat,
        COUNT(CASE WHEN a.status='absent'  THEN 1 END) as tidak_hadir,
        COUNT(CASE WHEN a.status='leave'   THEN 1 END) as cuti,
        COUNT(CASE WHEN a.status='sick'    THEN 1 END) as sakit,
        COUNT(a.id) as total_hari
       FROM users u
       LEFT JOIN attendances a ON u.id = a.user_id ${filter}
       WHERE u.role='employee' AND u.is_active=TRUE
       GROUP BY u.id ORDER BY u.name`,
      params
    );

    const [detail] = await pool.query(
      `SELECT u.name, u.employee_id, u.department, u.position, a.date, a.check_in, a.check_out, a.status, l.name as lokasi
       FROM attendances a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       WHERE 1=1 ${filter}
       ORDER BY u.name, a.date`,
      params
    );

    detail.forEach(r => { r.denda = calcLateFine(r.check_in, r.date, workStart, tolerance, r.status); });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'iWare Absenku';
    wb.created = new Date();
    wb.title = `Rekap Absensi ${label}`;
    wb.subject = 'Laporan Absensi Karyawan';

    // ── Sheet 1: Rekap ──
    const ws1 = wb.addWorksheet('Rekap Bulanan');
    ws1.columns = [
      { width: 5 }, { width: 28 }, { width: 14 }, { width: 18 }, { width: 18 },
      { width: 8 }, { width: 12 }, { width: 14 }, { width: 8 }, { width: 8 }
    ];
    styleExcelTitle(ws1, 10, `REKAP ABSENSI ${label.toUpperCase()}`);

    ws1.addRow([]);
    const hdr = ws1.addRow(['No','Nama','ID Karyawan','Departemen','Jabatan','Hadir','Terlambat','Tidak Hadir','Cuti','Sakit']);
    styleExcelHeaderRow(hdr);

    report.forEach((r, i) => {
      const row = ws1.addRow([i+1, r.name, r.employee_id||'-', r.department||'-', r.position||'-', r.hadir, r.terlambat, r.tidak_hadir, r.cuti, r.sakit]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      row.eachCell(borderThinCell);
    });

    ws1.views = [{ state: 'frozen', ySplit: hdr.number }];
    ws1.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number, column: 10 } };

    // ── Sheet 2: Detail (tabel datar, bisa difilter/dicari per nama) ──
    const ws2 = wb.addWorksheet('Detail Absensi');
    ws2.columns = [
      { width: 26 }, { width: 13 }, { width: 17 }, { width: 17 },
      { width: 12 }, { width: 11 }, { width: 11 }, { width: 12 }, { width: 20 }, { width: 14 }
    ];
    styleExcelTitle(ws2, 10, `DETAIL ABSENSI ${label.toUpperCase()}`);
    ws2.addRow([]);

    const hdr2 = ws2.addRow(['Nama','ID Karyawan','Departemen','Jabatan','Tanggal','Jam Masuk','Jam Pulang','Status','Lokasi','Denda']);
    styleExcelHeaderRow(hdr2);

    detail.forEach((r, i) => {
      const row = ws2.addRow([
        r.name, r.employee_id||'-', r.department||'-', r.position||'-',
        fmtDate(r.date), fmtTime(r.check_in), fmtTime(r.check_out), statusLabel(r.status), r.lokasi||'-',
        r.denda > 0 ? fmtRupiah(r.denda) : '-'
      ]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      row.eachCell(borderThinCell);
      row.getCell(1).alignment = { horizontal: 'left' };
      row.getCell(9).alignment = { horizontal: 'left' };
      if (r.denda > 0) row.getCell(10).font = { color: { argb: 'FFB91C1C' }, bold: true };
    });

    ws2.views = [{ state: 'frozen', ySplit: hdr2.number }];
    ws2.autoFilter = { from: { row: hdr2.number, column: 1 }, to: { row: hdr2.number, column: 10 } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rekap_absensi_${fileTag}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal export Excel' });
  }
};

// ── EXPORT REKAP ABSENSI PDF ──────────────────────────────────────────────────
const exportAttendancePDF = async (req, res) => {
  try {
    const { filter, params, label, fileTag } = buildDateFilter(req.query);

    const [report] = await pool.query(
      `SELECT u.name, u.employee_id, u.department,
        COUNT(CASE WHEN a.status='present' THEN 1 END) as hadir,
        COUNT(CASE WHEN a.status='late'    THEN 1 END) as terlambat,
        COUNT(CASE WHEN a.status='absent'  THEN 1 END) as tidak_hadir,
        COUNT(CASE WHEN a.status='leave'   THEN 1 END) as cuti,
        COUNT(CASE WHEN a.status='sick'    THEN 1 END) as sakit
       FROM users u
       LEFT JOIN attendances a ON u.id = a.user_id ${filter}
       WHERE u.role='employee' AND u.is_active=TRUE
       GROUP BY u.id ORDER BY u.name`,
      params
    );

    const [settings] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key='company_name'");
    const companyName = settings[0]?.setting_value || 'iWare Absenku';

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape', bufferPages: true });
    doc.info.Title = `Rekap Absensi ${label}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rekap_absensi_${fileTag}.pdf`);
    doc.pipe(res);

    drawReportHeader(doc, { companyName, reportTitle: `Rekap Absensi ${label}`, periodLabel: label, printedBy: req.user.name });

    // Table header
    const cols = [180, 80, 110, 55, 65, 75, 50, 50];
    const headers = ['Nama', 'ID', 'Departemen', 'Hadir', 'Terlambat', 'Tdk Hadir', 'Cuti', 'Sakit'];
    let x = 40;
    let headerY = doc.y;
    doc.rect(40, headerY - 3, doc.page.width - 80, 18).fill('#1E293B');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    headers.forEach((h, i) => {
      doc.text(h, x + 4, headerY, { width: cols[i] - 4, align: i > 2 ? 'center' : 'left', lineBreak: false });
      x += cols[i];
    });
    doc.y = headerY + 15;

    // Rows
    const rowHeight = 16;
    doc.font('Helvetica').fontSize(8);
    report.forEach((r, idx) => {
      if (doc.y > doc.page.height - 90) {
        doc.addPage();
        drawReportHeader(doc, { companyName, reportTitle: `Rekap Absensi ${label}`, periodLabel: label, printedBy: req.user.name });
        headerY = doc.y;
        x = 40;
        doc.rect(40, headerY - 3, doc.page.width - 80, 18).fill('#1E293B');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
        headers.forEach((h, i) => {
          doc.text(h, x + 4, headerY, { width: cols[i] - 4, align: i > 2 ? 'center' : 'left', lineBreak: false });
          x += cols[i];
        });
        doc.y = headerY + 15;
        doc.font('Helvetica').fontSize(8);
      }
      const rowY = doc.y;
      doc.rect(40, rowY - 2, doc.page.width - 80, rowHeight)
        .fill(idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF').stroke('#E2E8F0');
      x = 40;
      const vals = [r.name, r.employee_id||'-', r.department||'-', r.hadir, r.terlambat, r.tidak_hadir, r.cuti, r.sakit];
      vals.forEach((v, i) => {
        doc.fillColor('#1E293B').text(String(v), x + 4, rowY, { width: cols[i] - 4, align: i > 2 ? 'center' : 'left', lineBreak: false });
        x += cols[i];
      });
      doc.y = rowY + rowHeight;
    });

    drawPdfFooters(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal export PDF' });
  }
};

// ── EXPORT DETAIL ABSENSI PDF (per nama, per tanggal, jam masuk/pulang) ───────
const exportAttendanceDetailPDF = async (req, res) => {
  try {
    const { filter, params, label, fileTag } = buildDateFilter(req.query);

    const [rows] = await pool.query(
      `SELECT u.name, u.employee_id, u.department, a.date, a.check_in, a.check_out, a.status, l.name as lokasi
       FROM users u
       LEFT JOIN attendances a ON u.id = a.user_id ${filter}
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       WHERE u.role='employee' AND u.is_active=TRUE
       ORDER BY u.name, a.date`,
      params
    );

    const [settings] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key='company_name'");
    const companyName = settings[0]?.setting_value || 'iWare Absenku';

    const byUser = {};
    rows.forEach(r => {
      if (!byUser[r.name]) byUser[r.name] = { info: r, records: [] };
      if (r.date) byUser[r.name].records.push(r);
    });

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    doc.info.Title = `Detail Absensi ${label}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=detail_absensi_${fileTag}.pdf`);
    doc.pipe(res);

    const cols = [90, 110, 90, 90, 90];
    const headers = ['Tanggal', 'Jam Masuk', 'Jam Pulang', 'Status', 'Lokasi'];
    const tableLeft = 40;
    const tableWidth = cols.reduce((a, b) => a + b, 0);
    const rowHeight = 18;

    const drawTableHeader = () => {
      let x = tableLeft;
      const y = doc.y;
      doc.rect(tableLeft, y - 3, tableWidth, 20).fill('#E2E8F0').stroke('#CBD5E1');
      doc.fontSize(9).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.fillColor('#1E293B').text(h, x, y + 1, { width: cols[i], align: i === 0 ? 'left' : 'center', lineBreak: false });
        x += cols[i];
      });
      doc.y = y + 20;
    };

    Object.entries(byUser).forEach(([name, { info, records }], userIdx) => {
      if (userIdx > 0) doc.addPage();

      drawReportHeader(doc, { companyName, reportTitle: `Detail Absensi ${label}`, periodLabel: label, printedBy: req.user.name });

      // Section header per karyawan (kotak solid, senada dengan versi Excel)
      const titleY = doc.y;
      doc.rect(tableLeft, titleY, tableWidth, 26).fill('#1E293B');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text(name, tableLeft + 10, titleY + 4, { width: tableWidth - 20, lineBreak: false });
      doc.fontSize(8).font('Helvetica').fillColor('#CBD5E1')
        .text(`ID: ${info.employee_id || '-'}    Departemen: ${info.department || '-'}    Jabatan: ${info.position || '-'}`, tableLeft + 10, titleY + 16, { width: tableWidth - 20, lineBreak: false });
      doc.y = titleY + 26;

      doc.rect(tableLeft, doc.y, tableWidth, 16).fill('#F1F5F9');
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748B')
        .text(`Total: ${records.length} hari tercatat pada periode ini`, tableLeft + 10, doc.y + 4);
      doc.y += 16;

      drawTableHeader();

      doc.font('Helvetica').fontSize(8);
      records.forEach((r, idx) => {
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          drawReportHeader(doc, { companyName, reportTitle: `Detail Absensi ${label}`, periodLabel: label, printedBy: req.user.name });
          drawTableHeader();
          doc.font('Helvetica').fontSize(8);
        }
        const rowY = doc.y;
        doc.rect(tableLeft, rowY - 3, tableWidth, rowHeight)
          .fill(idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF').stroke('#E2E8F0');
        let x = tableLeft;
        const vals = [fmtDate(r.date), fmtTime(r.check_in), fmtTime(r.check_out), statusLabel(r.status), r.lokasi || '-'];
        vals.forEach((v, i) => {
          doc.fillColor('#1E293B').text(String(v), x, rowY + 2, { width: cols[i], align: i === 0 ? 'left' : 'center', lineBreak: false });
          x += cols[i];
        });
        doc.y = rowY + rowHeight;
      });

      if (records.length === 0) {
        doc.fontSize(9).fillColor('#94A3B8').text('Tidak ada data absensi pada periode ini.', 40, doc.y + 6);
        doc.y += rowHeight;
      }
    });

    drawPdfFooters(doc);
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal export detail PDF' });
  }
};

// ── EXPORT PERIZINAN EXCEL ────────────────────────────────────────────────────
const exportLeaveExcel = async (req, res) => {
  try {
    const { filter, params, label, fileTag } = buildDateFilter(req.query, 'lr', 'start_date');

    const [rows] = await pool.query(
      `SELECT u.name, u.employee_id, u.department, u.position,
              lr.type, lr.start_date, lr.end_date, lr.total_days, lr.reason, lr.status, lr.review_notes,
              rv.name as reviewer
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN users rv ON lr.reviewed_by = rv.id
       WHERE 1=1 ${filter}
       ORDER BY u.name, lr.start_date`,
      params
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'iWare Absenku';
    wb.title = `Laporan Perizinan ${label}`;
    wb.subject = 'Laporan Perizinan Karyawan';
    const ws = wb.addWorksheet('Perizinan');
    ws.columns = [
      { width: 5 }, { width: 28 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 16 },
      { width: 12 }, { width: 12 }, { width: 10 }, { width: 30 }, { width: 12 }, { width: 25 }
    ];

    styleExcelTitle(ws, 12, `LAPORAN PERIZINAN ${label.toUpperCase()}`);
    ws.addRow([]);

    const hdr = ws.addRow(['No','Nama','ID','Departemen','Jabatan','Jenis','Tgl Mulai','Tgl Selesai','Durasi','Alasan','Status','Catatan HRD']);
    styleExcelHeaderRow(hdr);

    const typeMap = { annual:'Cuti Tahunan', sick:'Izin Sakit', permission:'Izin', dinas:'Dinas Luar' };
    const statusMap = { pending:'Menunggu', approved:'Disetujui', rejected:'Ditolak' };

    rows.forEach((r, i) => {
      const row = ws.addRow([
        i+1, r.name, r.employee_id||'-', r.department||'-', r.position||'-',
        typeMap[r.type] || r.type,
        fmtDate(r.start_date), fmtDate(r.end_date),
        `${r.total_days} hari`,
        r.reason, statusMap[r.status] || r.status, r.review_notes||'-'
      ]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      row.eachCell(borderThinCell);
    });

    ws.views = [{ state: 'frozen', ySplit: hdr.number }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=laporan_perizinan_${fileTag}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal export Excel' });
  }
};

// ── EXPORT REKAP BULANAN PER KARYAWAN (detail lengkap) ───────────────────────
const exportMonthlyRecapExcel = async (req, res) => {
  try {
    const { filter, params: dateParams, label, fileTag } = buildDateFilter(req.query);
    const { userId } = req.query;

    let userFilter = '';
    const params = [...dateParams];
    if (userId) { userFilter = ' AND u.id = ?'; params.push(userId); }

    const [rows] = await pool.query(
      `SELECT u.name, u.employee_id, u.department,
              a.date, a.check_in, a.check_out, a.status, l.name as lokasi,
              ws.name as shift_name, ws.start_time as shift_start, ws.end_time as shift_end
       FROM users u
       LEFT JOIN attendances a ON u.id = a.user_id ${filter}
       LEFT JOIN attendance_locations l ON a.location_id = l.id
       LEFT JOIN user_shifts us ON u.id = us.user_id
         AND us.effective_date = (SELECT MAX(us2.effective_date) FROM user_shifts us2 WHERE us2.user_id = u.id AND us2.effective_date <= CURDATE())
       LEFT JOIN work_shifts ws ON us.shift_id = ws.id
       WHERE u.role='employee' AND u.is_active=TRUE ${userFilter}
       ORDER BY u.name, a.date`,
      params
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'iWare Absenku';
    wb.title = `Rekap Bulanan ${label}`;
    wb.subject = 'Rekap Absensi per Karyawan';

    // Group by user
    const byUser = {};
    rows.forEach(r => {
      if (!byUser[r.name]) byUser[r.name] = [];
      byUser[r.name].push(r);
    });

    Object.entries(byUser).forEach(([name, records]) => {
      const ws = wb.addWorksheet(name.substring(0, 31));
      const first = records[0];

      ws.columns = [{ width: 14 }, { width: 10 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 22 }, { width: 40 }];
      styleExcelTitle(ws, 8, `REKAP ABSENSI: ${name.toUpperCase()}`);

      const infoRow = ws.addRow([`Departemen: ${first.department||'-'}`, '', `Shift: ${first.shift_name||'Reguler'}`, '', `Periode: ${label}`]);
      infoRow.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
      ws.addRow([]);

      const hdr = ws.addRow(['Tanggal','Hari','Shift Masuk','Jam Masuk','Jam Pulang','Status','Lokasi','Keterangan']);
      styleExcelHeaderRow(hdr);

      const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      records.filter(r => r.date).forEach((r, i) => {
        const d = new Date(r.date);
        const row = ws.addRow([
          fmtDate(r.date), days[d.getDay()],
          r.shift_start ? `${r.shift_start.substring(0,5)} - ${r.shift_end.substring(0,5)}` : '-',
          fmtTime(r.check_in), fmtTime(r.check_out),
          statusLabel(r.status), r.lokasi||'-', ''
        ]);
        if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        row.eachCell(borderThinCell);
      });

      // Summary row
      const hadir = records.filter(r => r.status === 'present').length;
      const terlambat = records.filter(r => r.status === 'late').length;
      ws.addRow([]);
      const sumRow = ws.addRow(['TOTAL', '', '', '', '', '', '', `Hadir: ${hadir} | Terlambat: ${terlambat} | Cuti: ${records.filter(r=>r.status==='leave').length} | Sakit: ${records.filter(r=>r.status==='sick').length}`]);
      sumRow.font = { bold: true };
      sumRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      ws.views = [{ state: 'frozen', ySplit: hdr.number }];
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=rekap_bulanan_${fileTag}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal export rekap bulanan' });
  }
};

module.exports = { exportAttendanceExcel, exportAttendancePDF, exportAttendanceDetailPDF, exportLeaveExcel, exportMonthlyRecapExcel };
