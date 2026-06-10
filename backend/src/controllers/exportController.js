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

    const wb = new ExcelJS.Workbook();
    wb.creator = 'iWare Absenku';
    wb.created = new Date();

    // ── Sheet 1: Rekap ──
    const ws1 = wb.addWorksheet('Rekap Bulanan');
    ws1.mergeCells('A1:I1');
    ws1.getCell('A1').value = `REKAP ABSENSI ${label.toUpperCase()}`;
    ws1.getCell('A1').font = { bold: true, size: 14 };
    ws1.getCell('A1').alignment = { horizontal: 'center' };

    ws1.addRow([]);
    const hdr = ws1.addRow(['No','Nama','ID Karyawan','Departemen','Jabatan','Hadir','Terlambat','Tidak Hadir','Cuti','Sakit']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    hdr.alignment = { horizontal: 'center' };

    report.forEach((r, i) => {
      const row = ws1.addRow([i+1, r.name, r.employee_id||'-', r.department||'-', r.position||'-', r.hadir, r.terlambat, r.tidak_hadir, r.cuti, r.sakit]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });

    ws1.columns = [
      { width: 5 }, { width: 28 }, { width: 14 }, { width: 18 }, { width: 18 },
      { width: 8 }, { width: 12 }, { width: 14 }, { width: 8 }, { width: 8 }
    ];

    // ── Sheet 2: Detail ──
    const ws2 = wb.addWorksheet('Detail Absensi');
    const hdr2 = ws2.addRow(['Nama','ID Karyawan','Departemen','Jabatan','Tanggal','Jam Masuk','Jam Pulang','Status','Lokasi']);
    hdr2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    detail.forEach((r, i) => {
      const row = ws2.addRow([r.name, r.employee_id||'-', r.department||'-', r.position||'-', fmtDate(r.date), fmtTime(r.check_in), fmtTime(r.check_out), statusLabel(r.status), r.lokasi||'-']);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });

    ws2.columns = [{ width: 28 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 22 }];

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

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rekap_absensi_${fileTag}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text(companyName, { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`Rekap Absensi ${label}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.5);

    // Table header
    const cols = [180, 80, 110, 55, 65, 75, 50, 50];
    const headers = ['Nama', 'ID', 'Departemen', 'Hadir', 'Terlambat', 'Tdk Hadir', 'Cuti', 'Sakit'];
    let x = 40;
    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, x, doc.y, { width: cols[i], align: i > 2 ? 'center' : 'left' });
      x += cols[i];
    });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    doc.moveDown(0.2);

    // Rows
    doc.font('Helvetica').fontSize(8);
    report.forEach((r, idx) => {
      if (doc.y > doc.page.height - 80) { doc.addPage(); }
      const rowY = doc.y;
      if (idx % 2 === 0) {
        doc.rect(40, rowY - 2, doc.page.width - 80, 14).fill('#F8FAFC').stroke('#F8FAFC');
      }
      x = 40;
      const vals = [r.name, r.employee_id||'-', r.department||'-', r.hadir, r.terlambat, r.tidak_hadir, r.cuti, r.sakit];
      vals.forEach((v, i) => {
        doc.fillColor('#1E293B').text(String(v), x, rowY, { width: cols[i], align: i > 2 ? 'center' : 'left' });
        x += cols[i];
      });
      doc.moveDown(0.4);
    });

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#94A3B8').text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, { align: 'right' });
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal export PDF' });
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
    const ws = wb.addWorksheet('Perizinan');

    ws.mergeCells('A1:K1');
    ws.getCell('A1').value = `LAPORAN PERIZINAN ${label.toUpperCase()}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.addRow([]);

    const hdr = ws.addRow(['No','Nama','ID','Departemen','Jabatan','Jenis','Tgl Mulai','Tgl Selesai','Durasi','Alasan','Status','Catatan HRD']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    const typeMap = { annual:'Cuti Tahunan', sick:'Izin Sakit', permission:'Izin', wfh:'WFH', dinas:'Dinas Luar' };
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
    });

    ws.columns = [
      { width: 5 }, { width: 28 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 16 },
      { width: 12 }, { width: 12 }, { width: 10 }, { width: 30 }, { width: 12 }, { width: 25 }
    ];

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

    // Group by user
    const byUser = {};
    rows.forEach(r => {
      if (!byUser[r.name]) byUser[r.name] = [];
      byUser[r.name].push(r);
    });

    Object.entries(byUser).forEach(([name, records]) => {
      const ws = wb.addWorksheet(name.substring(0, 31));
      const first = records[0];

      ws.mergeCells('A1:H1');
      ws.getCell('A1').value = `Rekap Absensi: ${name}`;
      ws.getCell('A1').font = { bold: true, size: 13 };
      ws.addRow([`Departemen: ${first.department||'-'}`, '', `Shift: ${first.shift_name||'Reguler'}`, '', `Periode: ${label}`]);
      ws.addRow([]);

      const hdr = ws.addRow(['Tanggal','Hari','Shift Masuk','Jam Masuk','Jam Pulang','Status','Lokasi','Keterangan']);
      hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

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
      });

      // Summary row
      const hadir = records.filter(r => r.status === 'present').length;
      const terlambat = records.filter(r => r.status === 'late').length;
      ws.addRow([]);
      const sumRow = ws.addRow(['TOTAL', '', '', '', '', '', '', `Hadir: ${hadir} | Terlambat: ${terlambat} | Cuti: ${records.filter(r=>r.status==='leave').length} | Sakit: ${records.filter(r=>r.status==='sick').length}`]);
      sumRow.font = { bold: true };

      ws.columns = [{ width: 14 }, { width: 10 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 22 }, { width: 40 }];
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

module.exports = { exportAttendanceExcel, exportAttendancePDF, exportLeaveExcel, exportMonthlyRecapExcel };
