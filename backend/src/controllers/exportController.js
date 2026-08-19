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

    // ── Sheet 2: Detail (dikelompokkan per karyawan, dengan Daftar Isi ber-hyperlink) ──
    const ws2 = wb.addWorksheet('Detail Absensi');
    const SHEET2 = 'Detail Absensi';
    ws2.columns = [{ width: 14 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 22 }, { width: 16 }];
    styleExcelTitle(ws2, 6, `DETAIL ABSENSI ${label.toUpperCase()}`);
    ws2.addRow([]);
    const thin = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    const colHeaders = ['Tanggal','Jam Masuk','Jam Pulang','Status','Lokasi','Denda'];

    const detailByUser = {};
    detail.forEach(r => {
      const key = r.employee_id || r.name;
      if (!detailByUser[key]) detailByUser[key] = { info: r, records: [] };
      detailByUser[key].records.push(r);
    });
    const users = Object.values(detailByUser);

    // ── Pass 1: hitung baris awal (title row) tiap section ──
    const tocLabelRow = ws2.rowCount + 1;
    let cursor = tocLabelRow + users.length + 2; // +1 label TOC, +N baris nama, +1 spacer setelah TOC = baris title section pertama
    const startRows = users.map(({ records }) => {
      const start = cursor;
      cursor += 3 + records.length + 1; // title + summary + header + data rows + spacer
      return start;
    });

    // ── Daftar Isi ──
    const tocLabel = ws2.addRow([`Daftar Karyawan (klik nama untuk lompat ke data) — ${users.length} orang`]);
    ws2.mergeCells(tocLabel.number, 1, tocLabel.number, 6);
    tocLabel.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

    users.forEach(({ info }, idx) => {
      const row = ws2.addRow([]);
      const cell = row.getCell(1);
      cell.value = { text: `→ ${info.name}  (${info.employee_id || '-'})`, hyperlink: `#'${SHEET2}'!A${startRows[idx]}` };
      cell.font = { color: { argb: 'FF2563EB' }, underline: true, size: 10 };
    });
    ws2.addRow([]);

    // ── Pass 2: render section per karyawan ──
    users.forEach(({ info, records }, idx) => {
      const titleRow = ws2.addRow([`${info.name}  •  ${info.employee_id||'-'}  •  ${info.department||'-'}  •  ${info.position||'-'}`]);
      ws2.mergeCells(titleRow.number, 1, titleRow.number, 5);
      titleRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      titleRow.getCell(1).alignment = { vertical: 'middle' };
      titleRow.getCell(6).value = { text: '↑ Daftar Isi', hyperlink: `#'${SHEET2}'!A${tocLabel.number}` };
      titleRow.getCell(6).font = { size: 8, color: { argb: 'FFCBD5E1' }, underline: true };
      titleRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      titleRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
      titleRow.height = 20;

      const totalDendaUser = records.reduce((sum, r) => sum + r.denda, 0);
      const summaryRow = ws2.addRow([`Total: ${records.length} hari tercatat  •  Denda keterlambatan: ${fmtRupiah(totalDendaUser)}`]);
      ws2.mergeCells(summaryRow.number, 1, summaryRow.number, 6);
      summaryRow.getCell(1).font = { italic: true, size: 9, color: { argb: totalDendaUser > 0 ? 'FFB91C1C' : 'FF64748B' } };
      summaryRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      const hdrRow = ws2.addRow(colHeaders);
      hdrRow.eachCell(cell => {
        cell.font = { bold: true, size: 9, color: { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.border = { top: thin, bottom: thin, left: thin, right: thin };
        cell.alignment = { horizontal: 'center' };
      });

      records.forEach((r, i) => {
        const row = ws2.addRow([fmtDate(r.date), fmtTime(r.check_in), fmtTime(r.check_out), statusLabel(r.status), r.lokasi||'-', r.denda > 0 ? fmtRupiah(r.denda) : '-']);
        row.eachCell(cell => {
          cell.border = { top: thin, bottom: thin, left: thin, right: thin };
          cell.alignment = { horizontal: 'center' };
        });
        row.getCell(5).alignment = { horizontal: 'left' };
        if (r.denda > 0) row.getCell(6).font = { color: { argb: 'FFB91C1C' }, bold: true };
        if (i % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
      });

      if (idx < users.length - 1) ws2.addRow([]);
    });

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

// ── Helper: format menit (bisa > 24 jam, mis. akumulasi grand total) ke "HH:MM" ─
const fmtMinutesToHHMM = (totalMinutes) => {
  const m = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const timeStrToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};

const dtToMinutesOfDay = (dt) => {
  if (!dt) return null;
  const d = new Date(dt);
  return d.getHours() * 60 + d.getMinutes();
};

// ── EXPORT TIMESHEET ABSENSI EXCEL (format kartu jam kerja per hari, per karyawan) ─
// Satu baris = satu karyawan pada satu tanggal dalam periode (termasuk hari tanpa
// presensi), dengan kolom jadwal vs aktual, keterlambatan, pulang cepat, jam kerja,
// lembur, dan potongan izin per jam — ditutup baris TOTAL per karyawan + GRAND TOTAL.
const exportAttendanceTimesheetExcel = async (req, res) => {
  try {
    const { start_date, end_date, month, year, department, employee_id } = req.query;
    let rangeStart, rangeEnd, fileTag;
    if (start_date && end_date) {
      rangeStart = start_date; rangeEnd = end_date; fileTag = `${start_date}_${end_date}`;
    } else {
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year) || new Date().getFullYear();
      rangeStart = `${y}-${String(m).padStart(2,'0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      rangeEnd = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      fileTag = `${m}_${y}`;
    }

    let userFilter = '';
    const userParams = [];
    if (department) { userFilter += ' AND u.department = ?'; userParams.push(department); }
    if (employee_id) { userFilter += ' AND u.employee_id = ?'; userParams.push(employee_id); }

    const [users] = await pool.query(
      `SELECT id, employee_id, name FROM users u
       WHERE u.role='employee' AND u.is_active=TRUE ${userFilter}
       ORDER BY u.name`,
      userParams
    );

    const [settingsRows] = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('work_start_time','work_end_time','late_tolerance')"
    );
    const settingsMap = Object.fromEntries(settingsRows.map(r => [r.setting_key, r.setting_value]));
    const tolerance = parseInt(settingsMap.late_tolerance || '10');

    const [holidayRows] = await pool.query(
      'SELECT date FROM public_holidays WHERE date >= ? AND date <= ?',
      [rangeStart, rangeEnd]
    );
    const holidaySet = new Set(holidayRows.map(r => (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0])));

    const userIds = users.map(u => u.id);
    let attendanceRows = [], overtimeRows = [], hourlyLeaveRows = [];
    if (userIds.length) {
      const inClause = userIds.map(() => '?').join(',');
      [[attendanceRows], [overtimeRows], [hourlyLeaveRows]] = await Promise.all([
        pool.query(
          `SELECT user_id, date, check_in, check_out FROM attendances
           WHERE user_id IN (${inClause}) AND date >= ? AND date <= ?`,
          [...userIds, rangeStart, rangeEnd]
        ),
        pool.query(
          `SELECT user_id, date, start_time, end_time, duration_minutes FROM overtime_requests
           WHERE user_id IN (${inClause}) AND status='approved' AND date >= ? AND date <= ?`,
          [...userIds, rangeStart, rangeEnd]
        ),
        pool.query(
          `SELECT user_id, start_date as date, time_start, time_end FROM leave_requests
           WHERE user_id IN (${inClause}) AND status='approved' AND time_start IS NOT NULL AND time_end IS NOT NULL
             AND start_date >= ? AND start_date <= ?`,
          [...userIds, rangeStart, rangeEnd]
        ),
      ]);
    }

    const attByKey = {}, otByKey = {}, hlByKey = {};
    const dateKey = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0]);
    attendanceRows.forEach(r => { attByKey[`${r.user_id}_${dateKey(r.date)}`] = r; });
    overtimeRows.forEach(r => { const k = `${r.user_id}_${dateKey(r.date)}`; (otByKey[k] ||= []).push(r); });
    hourlyLeaveRows.forEach(r => { const k = `${r.user_id}_${dateKey(r.date)}`; (hlByKey[k] ||= []).push(r); });

    // Daftar tanggal dalam periode
    const dateList = [];
    for (let d = new Date(rangeStart + 'T00:00:00Z'); d <= new Date(rangeEnd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
      dateList.push(d.toISOString().split('T')[0]);
    }

    // Pre-fetch shift assignments per user (urut desc) untuk resolve cepat tanpa query per hari
    const shiftAssignByUser = {};
    if (userIds.length) {
      const inClause = userIds.map(() => '?').join(',');
      const [assigns] = await pool.query(
        `SELECT us.user_id, us.effective_date, ws.start_time, ws.end_time
         FROM user_shifts us JOIN work_shifts ws ON us.shift_id = ws.id
         WHERE us.user_id IN (${inClause}) AND ws.is_active = TRUE
         ORDER BY us.effective_date ASC`,
        userIds
      );
      assigns.forEach(a => { (shiftAssignByUser[a.user_id] ||= []).push(a); });
    }
    const resolveShift = (userId, date) => {
      if (holidaySet.has(date)) return { start_time: '00:00', end_time: '00:00' };
      const list = shiftAssignByUser[userId] || [];
      let picked = null;
      for (const a of list) { if (dateKey(a.effective_date) <= date) picked = a; else break; }
      if (picked) return { start_time: picked.start_time.substring(0,5), end_time: picked.end_time.substring(0,5) };
      return { start_time: settingsMap.work_start_time || '08:00', end_time: settingsMap.work_end_time || '17:00' };
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'iWare Absenku';
    wb.created = new Date();
    wb.title = `Export Attendance Report`;
    const ws = wb.addWorksheet('Export Attendance Report');

    const headers = ['Employee ID','Full Name','Date','Schedule Check In','Schedule Check Out','Check In','Check Out',
      'Late In','Early Out','Schedule Working Hour','Actual Working Hour','Real Working Hour',
      'Overtime Duration Before','Overtime Duration After','Hourly Time Off Taken'];
    ws.columns = headers.map((_, i) => ({ width: i < 2 ? 30.73 : 20.73 }));
    const hdrRow = ws.addRow(headers);
    hdrRow.font = { bold: true, size: 11 };

    const grand = { lateIn: 0, earlyOut: 0, schedWork: 0, actualWork: 0, realWork: 0, otBefore: 0, otAfter: 0, hourlyOff: 0 };
    const ORANGE = 'FFFFCBB1';

    users.forEach(u => {
      const totals = { lateIn: 0, earlyOut: 0, schedWork: 0, actualWork: 0, realWork: 0, otBefore: 0, otAfter: 0, hourlyOff: 0 };

      dateList.forEach(date => {
        const shift = resolveShift(u.id, date);
        const schedStart = timeStrToMinutes(shift.start_time);
        const schedEnd = timeStrToMinutes(shift.end_time);
        const schedWorkMin = schedEnd > schedStart ? schedEnd - schedStart : 0;

        const att = attByKey[`${u.id}_${date}`];
        const checkInMin = att ? dtToMinutesOfDay(att.check_in) : null;
        const checkOutMin = att ? dtToMinutesOfDay(att.check_out) : null;

        let lateIn = 0, earlyOut = 0, actualWorkMin = 0;
        if (checkInMin != null && schedWorkMin > 0) {
          const diff = checkInMin - schedStart;
          if (diff > tolerance) lateIn = diff;
        }
        if (checkOutMin != null && schedWorkMin > 0) {
          const diff = schedEnd - checkOutMin;
          if (diff > 0) earlyOut = diff;
        }
        if (checkInMin != null && checkOutMin != null && checkOutMin > checkInMin) {
          actualWorkMin = checkOutMin - checkInMin;
        }
        const realWorkMin = Math.max(0, actualWorkMin - lateIn - earlyOut);

        const ots = otByKey[`${u.id}_${date}`] || [];
        let otBefore = 0, otAfter = 0;
        ots.forEach(o => {
          const os = timeStrToMinutes(o.start_time);
          if (schedWorkMin > 0 && os < schedStart) otBefore += o.duration_minutes;
          else otAfter += o.duration_minutes;
        });

        const hls = hlByKey[`${u.id}_${date}`] || [];
        const hourlyOff = hls.reduce((sum, h) => sum + Math.max(0, timeStrToMinutes(h.time_end) - timeStrToMinutes(h.time_start)), 0);

        totals.lateIn += lateIn; totals.earlyOut += earlyOut; totals.schedWork += schedWorkMin;
        totals.actualWork += actualWorkMin; totals.realWork += realWorkMin;
        totals.otBefore += otBefore; totals.otAfter += otAfter; totals.hourlyOff += hourlyOff;

        ws.addRow([
          u.employee_id || '-', u.name, date,
          shift.start_time, shift.end_time,
          att?.check_in ? fmtTime(att.check_in) : null,
          att?.check_out ? fmtTime(att.check_out) : null,
          fmtMinutesToHHMM(lateIn), fmtMinutesToHHMM(earlyOut),
          fmtMinutesToHHMM(schedWorkMin), fmtMinutesToHHMM(actualWorkMin), fmtMinutesToHHMM(realWorkMin),
          fmtMinutesToHHMM(otBefore), fmtMinutesToHHMM(otAfter), fmtMinutesToHHMM(hourlyOff),
        ]);
      });

      const totalRow = ws.addRow([
        `TOTAL FOR EMPLOYEE : ${u.employee_id || '-'} - ${u.name}`, null, null, null, null, null, null,
        fmtMinutesToHHMM(totals.lateIn), fmtMinutesToHHMM(totals.earlyOut),
        fmtMinutesToHHMM(totals.schedWork), fmtMinutesToHHMM(totals.actualWork), fmtMinutesToHHMM(totals.realWork),
        fmtMinutesToHHMM(totals.otBefore), fmtMinutesToHHMM(totals.otAfter), fmtMinutesToHHMM(totals.hourlyOff),
      ]);
      totalRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } }; });

      Object.keys(grand).forEach(k => { grand[k] += totals[k]; });
    });

    const grandRow = ws.addRow([
      'GRAND TOTAL', null, null, null, null, null, null,
      fmtMinutesToHHMM(grand.lateIn), fmtMinutesToHHMM(grand.earlyOut),
      fmtMinutesToHHMM(grand.schedWork), fmtMinutesToHHMM(grand.actualWork), fmtMinutesToHHMM(grand.realWork),
      fmtMinutesToHHMM(grand.otBefore), fmtMinutesToHHMM(grand.otAfter), fmtMinutesToHHMM(grand.hourlyOff),
    ]);
    grandRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=export_attendance_timesheet_${fileTag}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal export timesheet' });
  }
};

module.exports = { exportAttendanceExcel, exportAttendancePDF, exportAttendanceDetailPDF, exportLeaveExcel, exportMonthlyRecapExcel, exportAttendanceTimesheetExcel };
