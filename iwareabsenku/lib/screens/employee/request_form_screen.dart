import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';

/// Supported request types — maps to leave_types.code or 'overtime'
enum RequestType {
  latePermission,  // Izin Terlambat
  earlyLeave,      // Izin Pulang Cepat
  leaveAnnual,     // Ajukan Cuti (annual)
  leaveWfh,        // Ajukan Cuti (WFH)
  sick,            // Izin Sakit
  dinas,           // Dinas Luar
  leaveOffice,     // Izin Keluar Kantor
  overtime,        // Ajukan Lembur
}

extension RequestTypeMeta on RequestType {
  String get label {
    switch (this) {
      case RequestType.latePermission: return 'Izin Terlambat';
      case RequestType.earlyLeave: return 'Izin Pulang Cepat';
      case RequestType.leaveAnnual: return 'Ajukan Cuti Tahunan';
      case RequestType.leaveWfh: return 'Ajukan WFH';
      case RequestType.sick: return 'Izin Sakit';
      case RequestType.dinas: return 'Dinas Luar';
      case RequestType.leaveOffice: return 'Izin Keluar Kantor';
      case RequestType.overtime: return 'Ajukan Lembur';
    }
  }

  String get apiType {
    switch (this) {
      case RequestType.latePermission: return 'late_permission';
      case RequestType.earlyLeave: return 'early_leave';
      case RequestType.leaveAnnual: return 'annual';
      case RequestType.leaveWfh: return 'wfh';
      case RequestType.sick: return 'sick';
      case RequestType.dinas: return 'dinas';
      case RequestType.leaveOffice: return 'leave_office';
      case RequestType.overtime: return 'overtime';
    }
  }

  bool get isOvertime => this == RequestType.overtime;
  bool get isSingleDay {
    switch (this) {
      case RequestType.latePermission:
      case RequestType.earlyLeave:
      case RequestType.sick:
      case RequestType.leaveOffice:
        return true;
      case RequestType.leaveAnnual:
      case RequestType.leaveWfh:
      case RequestType.dinas:
      case RequestType.overtime:
        return false;
    }
  }

  bool get isPermitType {
    return this == RequestType.latePermission || this == RequestType.earlyLeave || this == RequestType.leaveOffice;
  }

  bool get requiresAttachment {
    switch (this) {
      case RequestType.sick: return true;
      default: return false;
    }
  }

  IconData get icon {
    switch (this) {
      case RequestType.latePermission: return Icons.access_time_rounded;
      case RequestType.earlyLeave: return Icons.home_rounded;
      case RequestType.leaveAnnual: return Icons.beach_access_rounded;
      case RequestType.leaveWfh: return Icons.home_work_rounded;
      case RequestType.sick: return Icons.medical_services_rounded;
      case RequestType.dinas: return Icons.location_on_rounded;
      case RequestType.leaveOffice: return Icons.reply_rounded;
      case RequestType.overtime: return Icons.access_time_filled_rounded;
    }
  }

  Color get headerColor {
    switch (this) {
      case RequestType.latePermission: return const Color(0xFF2E7D32);
      case RequestType.earlyLeave: return const Color(0xFFFFB300);
      case RequestType.leaveAnnual: return const Color(0xFF00BCD4);
      case RequestType.leaveWfh: return const Color(0xFF0D9488);
      case RequestType.sick: return const Color(0xFF7C4DFF);
      case RequestType.dinas: return const Color(0xFF00E5FF);
      case RequestType.leaveOffice: return const Color(0xFFE040FB);
      case RequestType.overtime: return const Color(0xFFFFD600);
    }
  }
}

class RequestFormScreen extends StatefulWidget {
  final RequestType requestType;
  const RequestFormScreen({super.key, required this.requestType});

  @override
  State<RequestFormScreen> createState() => _RequestFormScreenState();
}

class _RequestFormScreenState extends State<RequestFormScreen> {
  final _reasonCtrl = TextEditingController();
  DateTime? _startDate, _endDate;
  TimeOfDay? _startTime, _endTime;
  File? _attachment;
  bool _loading = false;

  String get _headerTitle {
    switch (widget.requestType) {
      case RequestType.latePermission:
        return 'Izin Terlambat';
      case RequestType.earlyLeave:
        return 'Pulang Cepat';
      case RequestType.leaveAnnual:
        return 'Cuti Tahunan';
      case RequestType.leaveWfh:
        return 'Ajukan WFH';
      case RequestType.sick:
        return 'Izin Sakit';
      case RequestType.dinas:
        return 'Dinas Luar';
      case RequestType.leaveOffice:
        return 'Keluar Kantor';
      case RequestType.overtime:
        return 'Ajukan Lembur';
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.requestType.isSingleDay) {
      _startDate = DateTime.now();
      _endDate = _startDate;
    }
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? (_startDate ?? DateTime.now()) : (_endDate ?? _startDate ?? DateTime.now()),
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: ColorScheme.light(
            primary: widget.requestType.headerColor,
            onPrimary: Colors.white,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (widget.requestType.isSingleDay) _endDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart
          ? (_startTime ?? const TimeOfDay(hour: 17, minute: 0))
          : (_endTime ?? const TimeOfDay(hour: 19, minute: 0)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: ColorScheme.light(
            primary: widget.requestType.headerColor,
            onPrimary: Colors.white,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 16),
        Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 20),
        const Text('Lampirkan Bukti', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 16),
        ListTile(
          leading: Container(
            width: 42, height: 42,
            decoration: BoxDecoration(color: AppColors.primaryBg, borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.camera_alt_rounded, color: AppColors.primary, size: 20),
          ),
          title: const Text('Ambil Foto', style: TextStyle(fontWeight: FontWeight.w600)),
          onTap: () => Navigator.pop(context, ImageSource.camera),
        ),
        ListTile(
          leading: Container(
            width: 42, height: 42,
            decoration: BoxDecoration(color: AppColors.primaryBg, borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.photo_library_rounded, color: AppColors.primary, size: 20),
          ),
          title: const Text('Pilih dari Galeri', style: TextStyle(fontWeight: FontWeight.w600)),
          onTap: () => Navigator.pop(context, ImageSource.gallery),
        ),
        const SizedBox(height: 16),
      ])),
    );
    if (source == null) return;
    final img = await picker.pickImage(source: source, imageQuality: 80, maxWidth: 1024);
    if (img != null) setState(() => _attachment = File(img.path));
  }

  Future<void> _submit() async {
    if (_reasonCtrl.text.trim().isEmpty) {
      _snack('Harap isi alasan pengajuan', error: true);
      return;
    }
    if (_startDate == null) {
      _snack('Harap pilih tanggal', error: true);
      return;
    }
    if (!widget.requestType.isSingleDay && _endDate == null) {
      _snack('Harap pilih tanggal selesai', error: true);
      return;
    }
    if (widget.requestType.requiresAttachment && _attachment == null) {
      _snack('Harap lampirkan bukti pendukung', error: true);
      return;
    }
    if (widget.requestType.isOvertime) {
      if (_startTime == null || _endTime == null) {
        _snack('Harap pilih jam mulai dan selesai lembur', error: true);
        return;
      }
    }
    if (widget.requestType.isPermitType) {
      if (widget.requestType == RequestType.latePermission && _startTime == null) {
        _snack('Rencana jam masuk wajib diisi untuk izin terlambat', error: true);
        return;
      }
      if (widget.requestType == RequestType.earlyLeave && _endTime == null) {
        _snack('Rencana jam pulang wajib diisi untuk izin pulang cepat', error: true);
        return;
      }
      if (widget.requestType == RequestType.leaveOffice && (_startTime == null || _endTime == null)) {
        _snack('Jam izin keluar dan jam kembali wajib diisi untuk izin keluar kantor', error: true);
        return;
      }
      if (widget.requestType == RequestType.leaveOffice) {
        final startMinutes = _startTime!.hour * 60 + _startTime!.minute;
        final endMinutes = _endTime!.hour * 60 + _endTime!.minute;
        if (endMinutes <= startMinutes) {
          _snack('Jam kembali harus lebih besar dari jam keluar kantor', error: true);
          return;
        }
        if (endMinutes - startMinutes > 120) {
          _snack('Izin keluar kantor maksimal 2 jam', error: true);
          return;
        }
      }
    }

    setState(() => _loading = true);
    HapticFeedback.mediumImpact();

    try {
      final fmt = DateFormat('yyyy-MM-dd');
      final startStr = fmt.format(_startDate!);
      final endStr = widget.requestType.isSingleDay ? startStr : fmt.format(_endDate!);

      Map<String, dynamic> result;
      if (widget.requestType.isOvertime) {
        final startTimeStr = '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}';
        final endTimeStr = '${_endTime!.hour.toString().padLeft(2, '0')}:${_endTime!.minute.toString().padLeft(2, '0')}';
        result = await ApiService().submitOvertime(
          startStr, startTimeStr, endTimeStr, _reasonCtrl.text.trim(),
          attachment: _attachment,
        );
      } else {
        final timeStartStr = _startTime != null
          ? '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}'
          : null;
        final timeEndStr = _endTime != null
          ? '${_endTime!.hour.toString().padLeft(2, '0')}:${_endTime!.minute.toString().padLeft(2, '0')}'
          : null;
        result = await ApiService().submitLeave(
          widget.requestType.apiType, startStr, endStr, _reasonCtrl.text.trim(),
          attachment: _attachment,
          timeStart: timeStartStr,
          timeEnd: timeEndStr,
        );
      }

      if (!mounted) return;
      if (result['success'] == true) {
        _snack('Pengajuan ${widget.requestType.label.toLowerCase()} berhasil dikirim ✅');
        Navigator.pop(context, true);
      } else {
        _snack(result['message'] ?? 'Gagal mengirim pengajuan', error: true);
      }
    } catch (e) {
      if (!mounted) return;
      _snack('Terjadi kesalahan: $e', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Icon(error ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, color: Colors.white, size: 16),
        const SizedBox(width: 8),
        Expanded(child: Text(msg, style: const TextStyle(fontWeight: FontWeight.w500))),
      ]),
      backgroundColor: error ? AppColors.danger : AppColors.teal,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 3),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: CustomScrollView(
          slivers: [
            // ── Redesigned Header ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: ProfileHeader(
                title: _headerTitle,
                showBackButton: true,
                name: user?.name,
                position: user?.position ?? user?.roleLabel,
                department: user?.department ?? user?.deptPosition,
                avatarFilename: user?.avatar,
              ),
            ),
            // ── Form Body ────────────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Date picker
                  if (widget.requestType.isOvertime) ...[
                    _buildLabel('Tanggal Lembur'),
                  ] else if (widget.requestType.isSingleDay) ...[
                    _buildLabel('Tanggal'),
                  ] else ...[
                    _buildLabel('Rentang Tanggal'),
                  ],
                  const SizedBox(height: 8),
                  if (widget.requestType.isSingleDay || widget.requestType.isOvertime) ...[
                    _buildDateCard(
                      label: widget.requestType.isOvertime ? 'Tanggal' : 'Tanggal',
                      date: _startDate,
                      onTap: () => _pickDate(isStart: true),
                    ),
                  ] else ...[
                    Row(children: [
                      Expanded(child: _buildDateCard(
                        label: 'Mulai',
                        date: _startDate,
                        onTap: () => _pickDate(isStart: true),
                      )),
                      const SizedBox(width: 12),
                      Expanded(child: _buildDateCard(
                        label: 'Selesai',
                        date: _endDate,
                        onTap: () => _pickDate(isStart: false),
                      )),
                    ]),
                  ],
                  const SizedBox(height: 20),

                  // Time picker (overtime or permit types)
                  if (widget.requestType.isOvertime || widget.requestType.isPermitType) ...[
                    _buildLabel(widget.requestType.isOvertime ? 'Jam Lembur' : 'Jam Rencana'),
                    const SizedBox(height: 8),
                    Row(children: [
                      if (widget.requestType == RequestType.latePermission || widget.requestType == RequestType.leaveOffice) ...[
                        Expanded(child: _buildTimeCard(
                          label: widget.requestType == RequestType.latePermission ? 'Rencana Jam Masuk' : 'Jam Keluar',
                          time: _startTime,
                          onTap: () => _pickTime(isStart: true),
                        )),
                        const SizedBox(width: 12),
                      ],
                      if (widget.requestType == RequestType.earlyLeave || widget.requestType == RequestType.leaveOffice) ...[
                        Expanded(child: _buildTimeCard(
                          label: widget.requestType == RequestType.earlyLeave ? 'Rencana Jam Pulang' : 'Jam Kembali',
                          time: _endTime,
                          onTap: () => _pickTime(isStart: false),
                        )),
                      ],
                    ]),
                    if (widget.requestType == RequestType.latePermission)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text(
                          'Izin terlambat hanya boleh diajukan dengan rencana jam masuk maksimal 11:00 WIB.',
                          style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ),
                    if (widget.requestType == RequestType.earlyLeave)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text(
                          'Izin pulang cepat hanya boleh diajukan dengan rencana jam pulang minimal 13:00 WIB.',
                          style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ),
                    if (widget.requestType == RequestType.leaveOffice)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text(
                          'Izin keluar kantor maksimal 2 jam. Pastikan jam kembali lebih dari jam keluar.',
                          style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ),
                    const SizedBox(height: 20),
                  ],

                    // Reason
                    _buildLabel('Alasan'),
                    const SizedBox(height: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border, width: 1.2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: _reasonCtrl,
                      maxLines: 4,
                      maxLength: 500,
                      style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                      decoration: const InputDecoration(
                        filled: false,
                        hintText: 'Jelaskan alasan pengajuan Anda secara detail...',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: EdgeInsets.all(16),
                        counterStyle: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Attachment
                  _buildLabel(widget.requestType.requiresAttachment ? 'Lampiran Dokumen (Wajib)' : 'Lampiran Dokumen (Opsional)'),
                  const SizedBox(height: 10),
                  GestureDetector(
                    onTap: _pickImage,
                    child: _attachment == null
                        ? CustomPaint(
                            painter: DashedBorderPainter(
                              color: AppColors.border,
                              radius: 14,
                            ),
                            child: Container(
                              height: 120,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: widget.requestType.headerColor.withValues(alpha: 0.08),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      Icons.cloud_upload_outlined,
                                      color: widget.requestType.headerColor,
                                      size: 26,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Ketuk untuk mengambil foto atau lampiran',
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    'Format: JPG, PNG (maksimal 5MB)',
                                    style: TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.successBg,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.successBorder, width: 1.2),
                              boxShadow: AppColors.cardShadow(),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: AppColors.success.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.check_circle_rounded,
                                    color: AppColors.success,
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _attachment!.path.split('/').last,
                                        style: const TextStyle(
                                          color: AppColors.textPrimary,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 2),
                                      const Text(
                                        'Berhasil dilampirkan',
                                        style: TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 11.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.close_rounded, color: AppColors.textMuted, size: 20),
                                  onPressed: () => setState(() => _attachment = null),
                                ),
                              ],
                            ),
                          ),
                  ),
                  const SizedBox(height: 32),

                  // Submit button
                  PrimaryButton(
                    text: 'Kirim Pengajuan',
                    isLoading: _loading,
                    onPressed: _submit,
                  ),
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
    );
  }

  Widget _buildDateCard({
    required String label,
    required DateTime? date,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border, width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(children: [
          Icon(Icons.calendar_today_rounded, color: widget.requestType.headerColor, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600)),
              const SizedBox(height: 3),
              Text(
                date != null ? DateFormat('d MMM yyyy', 'id_ID').format(date) : 'Pilih tanggal',
                style: TextStyle(
                  color: date != null ? AppColors.textPrimary : AppColors.textHint,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ]),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 18),
        ]),
      ),
    );
  }

  Widget _buildTimeCard({
    required String label,
    required TimeOfDay? time,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border, width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(children: [
          Icon(Icons.schedule_rounded, color: widget.requestType.headerColor, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.w600)),
              const SizedBox(height: 3),
              Text(
                time != null ? time.format(context) : 'Pilih jam',
                style: TextStyle(
                  color: time != null ? AppColors.textPrimary : AppColors.textHint,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ]),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 18),
        ]),
      ),
    );
  }
}

class DashedBorderPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double gap;
  final double dashLength;
  final double radius;

  DashedBorderPainter({
    required this.color,
    this.strokeWidth = 1.2,
    this.gap = 4.0,
    this.dashLength = 6.0,
    this.radius = 14.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final path = Path();
    path.addRRect(RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(radius),
    ));

    final dashPath = Path();
    double distance = 0.0;
    for (final pathMetric in path.computeMetrics()) {
      while (distance < pathMetric.length) {
        final len = dashLength;
        dashPath.addPath(
          pathMetric.extractPath(distance, distance + len),
          Offset.zero,
        );
        distance += len + gap;
      }
    }
    canvas.drawPath(dashPath, paint);
  }

  @override
  bool shouldRepaint(covariant DashedBorderPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.gap != gap ||
        oldDelegate.dashLength != dashLength ||
        oldDelegate.radius != radius;
  }
}