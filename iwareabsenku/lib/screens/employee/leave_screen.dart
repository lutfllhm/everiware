import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../services/realtime_service.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/animations.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});
  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<LeaveModel> _leaves = [];
  Map<String, dynamic>? _quota;
  List<Map<String, dynamic>> _leaveTypes = [];
  bool _loading = true;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _loadData();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'leave_update') {
        _loadData();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        ApiService().getMyLeaves(),
        ApiService().getLeaveQuota(),
        ApiService().getLeaveTypes(),
      ]);
      if (mounted) {
        setState(() {
          _leaves = (results[0]['leaves'] as List? ?? [])
              .map((l) => LeaveModel.fromJson(l))
              .toList();
          _quota = results[1]['quota'];
          _leaveTypes = (results[2]['leaveTypes'] as List? ?? [])
              .map((t) => Map<String, dynamic>.from(t))
              .toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [
          SliverToBoxAdapter(child: _buildHeroHeader()),
        ],
        body: TabBarView(
          controller: _tabCtrl,
          children: [
            _HistoryTab(leaves: _leaves, quota: _quota, loading: _loading, onRefresh: _loadData),
            _UnifiedFormTab(leaveTypes: _leaveTypes, onSubmit: () { _loadData(); _tabCtrl.animateTo(0); }),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroHeader() {
    final user = context.watch<AuthProvider>().user;
    return ProfileHeader(
      title: 'Izin & Cuti',
      showBackButton: true,
      name: user?.name,
      avatarFilename: user?.avatar,
      position: user?.position ?? user?.roleLabel ?? '',
      department: user != null && ((user.department ?? '').isNotEmpty || user.deptPosition != '-')
          ? ((user.department ?? '').isNotEmpty ? user.department! : user.deptPosition)
          : null,
      bottomWidget: TabBar(
        controller: _tabCtrl,
        labelColor: Colors.white,
        unselectedLabelColor: Colors.white60,
        indicatorColor: const Color(0xFFEF5350),
        indicatorWeight: 3,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: Colors.transparent,
        labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
        tabs: const [
          Tab(text: 'Riwayat'),
          Tab(text: 'Ajukan Izin'),
        ],
      ),
    );
  }
}

//  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
// HISTORY TAB
//  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
class _HistoryTab extends StatelessWidget {
  final List<LeaveModel> leaves;
  final Map<String, dynamic>? quota;
  final bool loading;
  final VoidCallback onRefresh;

  const _HistoryTab({
    required this.leaves,
    this.quota,
    required this.loading,
    required this.onRefresh,
  });

  Future<void> _cancelLeave(BuildContext context, LeaveModel leave) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Handle
          Container(width: 40, height: 4,
              decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),
          // Icon
          Container(
            width: 60, height: 60,
            decoration: BoxDecoration(
              color: AppColors.dangerBg,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.cancel_outlined, color: AppColors.danger, size: 28),
          ),
          const SizedBox(height: 16),
          const Text('Batalkan Pengajuan?',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          Text(
            'Pengajuan ${leave.typeLabel} kamu akan dibatalkan dan tidak bisa dikembalikan.',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(
              child: SecondaryButton(
                text: 'Tidak',
                onPressed: () => Navigator.pop(context, false),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SizedBox(
                height: 52,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.danger.withValues(alpha: 0.30),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Ya, Batalkan', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ),
            ),
          ]),
        ]),
      ),
    );
    if (ok != true) return;
    final data = await ApiService().cancelLeave(leave.id);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Icon(
          data['success'] == true ? Icons.check_circle_rounded : Icons.error_rounded,
          color: Colors.white, size: 18,
        ),
        const SizedBox(width: 10),
        Text(data['success'] == true ? 'Pengajuan berhasil dibatalkan' : (data['message'] ?? 'Gagal')),
      ]),
      backgroundColor: data['success'] == true ? AppColors.teal : AppColors.danger,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.all(16),
    ));
    if (data['success'] == true) onRefresh();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
        children: [
          //  -  -  Quota Card  -  - 
          if (quota != null) ...[
            _buildQuotaCard(),
            const SizedBox(height: 20),
          ],

          //  -  -  List  -  - 
          if (loading)
            Column(children: List.generate(3, (_) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: const ShimmerBox(width: double.infinity, height: 90, radius: 16),
            )))
          else if (leaves.isEmpty)
            const EmptyState(
              icon: Icons.inbox_outlined,
              title: 'Belum ada pengajuan',
              subtitle: 'Pengajuan cuti atau izin sakit\nakan muncul di sini',
            )
          else
            ...leaves.asMap().entries.map((e) => Padding(
              key: ValueKey(e.value.id),
              padding: const EdgeInsets.only(bottom: 12),
              child: FadeSlideIn(
                delay: Duration(milliseconds: 60 * e.key),
                child: _LeaveCard(
                  leave: e.value,
                  onCancel: e.value.canCancel ? () => _cancelLeave(context, e.value) : null,
                ),
              ),
            )),
        ],
      ),
    );
  }

  Widget _buildQuotaCard() {
    final total = (quota?['total_days'] as num?)?.toDouble() ?? 0.0;
    final used = (quota?['used_days'] as num?)?.toDouble() ?? 0.0;
    final remaining = (quota?['remaining_days'] as num?)?.toDouble() ?? 0.0;
    final progress = total > 0 ? used / total : 0.0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF5C0A0A), Color(0xFF8B1F1F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8B1F1F).withValues(alpha: 0.15),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.beach_access_rounded, color: Colors.white, size: 16),
          const SizedBox(width: 8),
          Text('Jatah Cuti ${quota?['year'] ?? ''}',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
          const Spacer(),
          Text('$remaining hari tersisa',
              style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.75))),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          _QuotaStatItem(value: '$total', label: 'Total'),
          Container(width: 1, height: 28, color: Colors.white.withValues(alpha: 0.20), margin: const EdgeInsets.symmetric(horizontal: 14)),
          _QuotaStatItem(value: '$used', label: 'Terpakai'),
          Container(width: 1, height: 28, color: Colors.white.withValues(alpha: 0.20), margin: const EdgeInsets.symmetric(horizontal: 14)),
          _QuotaStatItem(value: '$remaining', label: 'Sisa'),
        ]),
        const SizedBox(height: 14),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: Stack(children: [
            Container(height: 8, width: double.infinity, color: Colors.white.withValues(alpha: 0.20)),
            FractionallySizedBox(
              widthFactor: progress.toDouble().clamp(0.0, 1.0),
              child: Container(height: 8, color: Colors.white),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _QuotaStatItem extends StatelessWidget {
  final String value, label;
  const _QuotaStatItem({required this.value, required this.label});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(value, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, height: 1.0)),
    const SizedBox(height: 2),
    Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 11)),
  ]);
}

class _LeaveCard extends StatelessWidget {
  final LeaveModel leave;
  final VoidCallback? onCancel;
  const _LeaveCard({required this.leave, this.onCancel});

  // Warna per tipe izin — lebih muted, tidak terlalu mencolok
  static const _typeMap = {
    'annual':     {'color': Color(0xFF8B1F1F), 'bg': Color(0xFFFFEBEE), 'label': 'Cuti Tahunan'},
    'sick':       {'color': Color(0xFF0284C7), 'bg': Color(0xFFF0F9FF), 'label': 'Izin Sakit'},
    'wfh':        {'color': Color(0xFF0D9488), 'bg': Color(0xFFF0FDFA), 'label': 'WFH'},
    'dinas':      {'color': Color(0xFFD97706), 'bg': Color(0xFFFFFBEB), 'label': 'Dinas Luar'},
    'permission': {'color': Color(0xFF7C3AED), 'bg': Color(0xFFF5F3FF), 'label': 'Izin'},
  };

  @override
  Widget build(BuildContext context) {
    final cfg = _typeMap[leave.type] ?? {'color': AppColors.primary, 'bg': AppColors.primaryBg, 'label': leave.typeLabel};
    final typeColor = cfg['color'] as Color;
    final typeBg    = cfg['bg'] as Color;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: typeColor.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left accent bar
              Container(
                width: 5,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [typeColor, typeColor.withValues(alpha: 0.6)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
              // Content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // Header row
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: typeBg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          cfg['label'] as String,
                          style: TextStyle(color: typeColor, fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                      ),
                      const Spacer(),
                      StatusBadge(status: leave.status),
                    ]),
                    const SizedBox(height: 10),
                    // Reason
                    Text(
                      leave.reason,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    // Date + duration row
                    Row(children: [
                      Icon(Icons.calendar_today_outlined, size: 12, color: typeColor),
                      const SizedBox(width: 5),
                      Text(
                        '${DateFormat('d MMM', 'id_ID').format(DateTime.parse(leave.startDate))} – '
                        '${DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(leave.endDate))}',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: typeBg,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${leave.totalDays} hari',
                          style: TextStyle(fontSize: 11, color: typeColor, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ]),
                    // Review notes
                    if (leave.reviewNotes != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.grey50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Icon(Icons.comment_outlined, size: 12, color: AppColors.textMuted),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '${leave.reviewNotes}',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                            ),
                          ),
                        ]),
                      ),
                    ],
                    // Cancel button
                    if (leave.canCancel && onCancel != null) ...[
                      const SizedBox(height: 10),
                      ScaleTap(
                        onTap: onCancel,
                        scale: 0.96,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          decoration: BoxDecoration(
                            color: AppColors.dangerBg,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.cancel_outlined, size: 14, color: AppColors.danger),
                              SizedBox(width: 6),
                              Text('Batalkan Pengajuan',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                                      color: AppColors.danger)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

//  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
// UNIFIED LEAVE FORM TAB (dynamic types)
//  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
class _UnifiedFormTab extends StatefulWidget {
  final List<Map<String, dynamic>> leaveTypes;
  final VoidCallback onSubmit;
  const _UnifiedFormTab({required this.leaveTypes, required this.onSubmit});
  @override
  State<_UnifiedFormTab> createState() => _UnifiedFormTabState();
}

class _UnifiedFormTabState extends State<_UnifiedFormTab> {
  final _reasonCtrl = TextEditingController();
  DateTime? _startDate, _endDate;
  TimeOfDay? _timeStart, _timeEnd;
  File? _attachment;
  bool _loading = false;
  String? _selectedType;

  @override
  void didUpdateWidget(_UnifiedFormTab old) {
    super.didUpdateWidget(old);
    if (widget.leaveTypes.isNotEmpty && _selectedType == null) {
      _selectedType = widget.leaveTypes.first['code'] as String?;
    }
  }

  /// Returns true if the selected type is a non-blocking permit that needs time fields
  bool get _isPermitType => _selectedType != null && [
    'late_permission', 'early_leave', 'leave_office',
  ].contains(_selectedType);

  /// Returns true if the selected permit type should show time_start picker
  bool get _showTimeStart => _selectedType == 'late_permission' || _selectedType == 'leave_office';

  /// Returns true if the selected permit type should show time_end picker
  bool get _showTimeEnd => _selectedType == 'early_leave' || _selectedType == 'leave_office';

  @override
  void dispose() { _reasonCtrl.dispose(); super.dispose(); }

  Map<String, dynamic>? get _currentType =>
      widget.leaveTypes.where((t) => t['code'] == _selectedType).firstOrNull;

  bool get _requiresAttachment => _currentType?['requires_attachment'] == true || _currentType?['requires_attachment'] == 1;

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF8B1F1F),
            onPrimary: Colors.white,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => isStart ? _startDate = picked : _endDate = picked);
  }

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF8B1F1F),
            onPrimary: Colors.white,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() => isStart ? _timeStart = picked : _timeEnd = picked);
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 16),
        const Text('Pilih Sumber Foto', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        ListTile(
          leading: const Icon(Icons.camera_alt_rounded, color: AppColors.primary),
          title: const Text('Kamera'),
          onTap: () => Navigator.pop(context, ImageSource.camera),
        ),
        ListTile(
          leading: const Icon(Icons.photo_library_rounded, color: AppColors.info),
          title: const Text('Galeri'),
          onTap: () => Navigator.pop(context, ImageSource.gallery),
        ),
        const SizedBox(height: 16),
      ])),
    );
    if (source == null) return;
    final img = await picker.pickImage(source: source, imageQuality: 80);
    if (img != null) setState(() => _attachment = File(img.path));
  }

  Future<void> _submit() async {
    if (_selectedType == null || _startDate == null || _endDate == null || _reasonCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Semua field wajib diisi'), backgroundColor: AppColors.primary,
      ));
      return;
    }
    if (_requiresAttachment && _attachment == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Bukti foto wajib untuk ${_currentType?['name']}'),
        backgroundColor: AppColors.primary,
      ));
      return;
    }
    if (_selectedType == 'late_permission' && _timeStart == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Rencana jam masuk wajib diisi untuk izin terlambat'), backgroundColor: AppColors.primary,
      ));
      return;
    }
    if (_selectedType == 'early_leave' && _timeEnd == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Rencana jam pulang wajib diisi untuk izin pulang cepat'), backgroundColor: AppColors.primary,
      ));
      return;
    }
    if (_selectedType == 'leave_office') {
      if (_timeStart == null || _timeEnd == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Jam izin keluar dan jam kembali wajib diisi untuk izin keluar kantor'), backgroundColor: AppColors.primary,
        ));
        return;
      }
      final startMinutes = _timeStart!.hour * 60 + _timeStart!.minute;
      final endMinutes = _timeEnd!.hour * 60 + _timeEnd!.minute;
      if (endMinutes <= startMinutes) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Jam kembali harus lebih besar dari jam keluar kantor'), backgroundColor: AppColors.primary,
        ));
        return;
      }
      if (endMinutes - startMinutes > 120) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Izin keluar kantor maksimal 2 jam'), backgroundColor: AppColors.primary,
        ));
        return;
      }
    }
    // Convert TimeOfDay to HH:mm strings if set
    String? timeStartStr = _timeStart != null
        ? '${_timeStart!.hour.toString().padLeft(2, '0')}:${_timeStart!.minute.toString().padLeft(2, '0')}'
        : null;
    String? timeEndStr = _timeEnd != null
        ? '${_timeEnd!.hour.toString().padLeft(2, '0')}:${_timeEnd!.minute.toString().padLeft(2, '0')}'
        : null;
    setState(() => _loading = true);
    try {
      final data = await ApiService().submitLeave(
        _selectedType!,
        DateFormat('yyyy-MM-dd').format(_startDate!),
        DateFormat('yyyy-MM-dd').format(_endDate!),
        _reasonCtrl.text,
        attachment: _attachment,
        timeStart: timeStartStr,
        timeEnd: timeEndStr,
      );
      if (!mounted) return;
      if (data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(data['message']), backgroundColor: AppColors.teal,
        ));
        _reasonCtrl.clear();
        setState(() {
          _startDate = null; _endDate = null;
          _timeStart = null; _timeEnd = null;
          _attachment = null;
        });
        widget.onSubmit();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(data['message'] ?? 'Gagal'), backgroundColor: AppColors.primary,
        ));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Gagal mengajukan'), backgroundColor: AppColors.primary,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Jenis izin selector
      const Text('Jenis Izin', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
      const SizedBox(height: 10),
      if (widget.leaveTypes.isEmpty)
        const Center(child: CircularProgressIndicator(color: AppColors.primary))
      else
        Wrap(spacing: 8, runSpacing: 8, children: widget.leaveTypes.map((t) {
          final selected = _selectedType == t['code'];
          return ScaleTap(
            onTap: () => setState(() {
              _selectedType = t['code'] as String;
              // Reset time fields when type changes
              _timeStart = null;
              _timeEnd = null;
            }),
            scale: 0.95,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOut,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                gradient: selected
                    ? const LinearGradient(
                        colors: [Color(0xFF8B1F1F), Color(0xFFE53935)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: selected ? null : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: selected ? Colors.transparent : const Color(0xFFE5E7EB),
                  width: 1,
                ),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: const Color(0xFF8B1F1F).withValues(alpha: 0.2),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ]
                    : [],
              ),
              child: Text(
                t['name'] as String,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : AppColors.textSecondary,
                ),
              ),
            ),
          );
        }).toList()),
      const SizedBox(height: 20),

      AppCard(
        padding: const EdgeInsets.all(20),
        radius: 18,
        hasShadow: true,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Periode', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _DatePickerField(label: 'Mulai', date: _startDate, onTap: () => _pickDate(true))),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                '—',
                style: TextStyle(
                  fontSize: 16,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Expanded(child: _DatePickerField(label: 'Selesai', date: _endDate, onTap: () => _pickDate(false))),
          ]),
          if (_startDate != null && _endDate != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFEBEE),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(children: [
                const Icon(Icons.info_outline, size: 14, color: Color(0xFF8B1F1F)),
                const SizedBox(width: 6),
                Text(
                  'Durasi: ${_endDate!.difference(_startDate!).inDays + 1} hari',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF8B1F1F), fontWeight: FontWeight.w600),
                ),
              ]),
            ),
          ],

          // Waktu Izin - hanya tampil untuk non-blocking permits
          if (_isPermitType) ...[
            const SizedBox(height: 18),
            const Text('Waktu Izin', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            if (_showTimeStart)
              GestureDetector(
                onTap: () => _pickTime(true),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
                  ),
                  child: Row(children: [
                    const Icon(Icons.access_time_rounded, size: 16, color: AppColors.textMuted),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(
                          _selectedType == 'late_permission' ? 'Rencana Jam Masuk' : 'Jam Tinggalkan Kantor',
                          style: const TextStyle(
                            fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _timeStart != null
                              ? '${_timeStart!.hour.toString().padLeft(2, '0')}:${_timeStart!.minute.toString().padLeft(2, '0')}'
                              : 'Pilih Jam',
                          style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700,
                            color: _timeStart != null ? AppColors.textPrimary : AppColors.textHint,
                          ),
                        ),
                      ]),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: AppColors.textMuted),
                  ]),
                ),
              ),
            if (_showTimeEnd)
              GestureDetector(
                onTap: () => _pickTime(false),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
                  ),
                  child: Row(children: [
                    const Icon(Icons.access_time_rounded, size: 16, color: AppColors.textMuted),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(
                          _selectedType == 'early_leave' ? 'Rencana Jam Pulang' : 'Rencana Jam Kembali',
                          style: const TextStyle(
                            fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _timeEnd != null
                              ? '${_timeEnd!.hour.toString().padLeft(2, '0')}:${_timeEnd!.minute.toString().padLeft(2, '0')}'
                              : 'Pilih Jam',
                          style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700,
                            color: _timeEnd != null ? AppColors.textPrimary : AppColors.textHint,
                          ),
                        ),
                      ]),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: AppColors.textMuted),
                  ]),
                ),
              ),
              if (_selectedType == 'late_permission')
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'Izin terlambat hanya boleh diajukan dengan rencana jam masuk maksimal 11:00 WIB.',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
              if (_selectedType == 'early_leave')
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'Izin pulang cepat hanya boleh diajukan dengan rencana jam pulang minimal 13:00 WIB.',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
              if (_selectedType == 'leave_office')
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'Izin keluar kantor maksimal 2 jam. Pastikan jam kembali lebih dari jam keluar.',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
          ],

          const SizedBox(height: 18),
          const Text('Alasan / Keterangan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          TextField(
            controller: _reasonCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Jelaskan alasan pengajuan...',
              hintStyle: const TextStyle(color: AppColors.textHint, fontSize: 13),
              filled: true,
              fillColor: const Color(0xFFF9F9F9),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB), width: 1),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF8B1F1F), width: 1.5),
              ),
            ),
          ),

          // Lampiran - hanya tampil jika tipe butuh attachment
          if (_requiresAttachment) ...[
            const SizedBox(height: 18),
            const Text('Bukti / Lampiran *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            if (_attachment != null)
              Stack(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(_attachment!, height: 160, width: double.infinity, fit: BoxFit.cover),
                ),
                Positioned(top: 8, right: 8, child: GestureDetector(
                  onTap: () => setState(() => _attachment = null),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(color: Color(0xFF8B1F1F), shape: BoxShape.circle),
                    child: const Icon(Icons.close, color: Colors.white, size: 14),
                  ),
                )),
              ])
            else
              GestureDetector(
                onTap: _pickImage,
                child: Container(
                  height: 100, width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9F9F9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
                  ),
                  child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.upload_file_rounded, color: AppColors.textMuted, size: 28),
                    SizedBox(height: 6),
                    Text('Tap untuk upload foto/dokumen', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  ]),
                ),
              ),
          ],

          const SizedBox(height: 24),
          PrimaryButton(
            text: 'Kirim Pengajuan',
            onPressed: _submit,
            isLoading: _loading,
            icon: Icons.send_rounded,
          ),
        ]),
      ),
    ]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE PICKER FIELD — Desain baru netral dengan ikon kalender
// ─────────────────────────────────────────────────────────────────────────────
class _DatePickerField extends StatelessWidget {
  final String label;
  final DateTime? date;
  final VoidCallback onTap;
  const _DatePickerField({required this.label, this.date, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.calendar_today_rounded, size: 13, color: AppColors.textMuted),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ]),
        const SizedBox(height: 6),
        Text(
          date != null ? DateFormat('d MMM yyyy', 'id_ID').format(date!) : 'Pilih tanggal',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: date != null ? AppColors.textPrimary : AppColors.textHint,
          ),
        ),
      ]),
    ),
  );
}

