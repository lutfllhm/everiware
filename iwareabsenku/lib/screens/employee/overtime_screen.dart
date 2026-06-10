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
import '../../utils/constants.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/zoomable_image.dart';

class OvertimeScreen extends StatefulWidget {
  const OvertimeScreen({super.key});
  @override
  State<OvertimeScreen> createState() => _OvertimeScreenState();
}

class _OvertimeScreenState extends State<OvertimeScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<OvertimeModel> _overtimes = [];
  bool _loading = true;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _loadData();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'overtime_update') {
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
    setState(() => _loading = true);
    try {
      final data = await ApiService().getMyOvertime();
      if (mounted) {
        setState(() {
          _overtimes = (data['overtimes'] as List? ?? [])
              .map((o) => OvertimeModel.fromJson(o))
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
            _HistoryTab(overtimes: _overtimes, loading: _loading, onRefresh: _loadData),
            _FormTab(onSubmit: () {
              _loadData();
              _tabCtrl.animateTo(0);
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroHeader() {
    final user = context.watch<AuthProvider>().user;
    return ProfileHeader(
      title: 'Pengajuan Lembur',
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
          Tab(text: 'Ajukan Lembur'),
        ],
      ),
    );
  }
}

// ── HISTORY TAB (Calendar View) ───────────────────────────────────────────────
class _HistoryTab extends StatefulWidget {
  final List<OvertimeModel> overtimes;
  final bool loading;
  final VoidCallback onRefresh;

  const _HistoryTab({
    required this.overtimes,
    required this.loading,
    required this.onRefresh,
  });

  @override
  State<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<_HistoryTab> {
  late DateTime _currentMonth;
  OvertimeModel? _selectedOvertime;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _currentMonth = DateTime(now.year, now.month, 1);
  }

  void _prevMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1, 1);
      _selectedOvertime = null;
    });
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 1);
      _selectedOvertime = null;
    });
  }

  // Returns overtime on a given day, or null
  OvertimeModel? _overtimeOnDate(DateTime day) {
    final dateStr = DateFormat('yyyy-MM-dd').format(day);
    try {
      return widget.overtimes.firstWhere((o) => o.date == dateStr);
    } catch (_) {
      return null;
    }
  }

  Color? _statusColor(String? status) {
    switch (status) {
      case 'approved':
        return AppColors.teal;
      case 'pending':
        return AppColors.amber;
      case 'rejected':
        return AppColors.danger;
      default:
        return null;
    }
  }

  IconData _statusIcon(String? status) {
    switch (status) {
      case 'approved':
        return Icons.check_circle_rounded;
      case 'pending':
        return Icons.hourglass_empty_rounded;
      case 'rejected':
        return Icons.cancel_rounded;
      default:
        return Icons.access_time_rounded;
    }
  }

  Future<void> _cancel(BuildContext context, OvertimeModel ot) async {
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
          Container(width: 40, height: 4,
              decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),
          Container(
            width: 60, height: 60,
            decoration: const BoxDecoration(color: AppColors.dangerBg, shape: BoxShape.circle),
            child: const Icon(Icons.access_time_rounded, color: AppColors.danger, size: 28),
          ),
          const SizedBox(height: 16),
          const Text('Batalkan Lembur?',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          Text(
            'Pengajuan lembur ${DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(ot.date))} akan dibatalkan.',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(child: SecondaryButton(text: 'Tidak', onPressed: () => Navigator.pop(context, false))),
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
                    boxShadow: [BoxShadow(color: AppColors.danger.withValues(alpha: 0.30), blurRadius: 12, offset: const Offset(0, 4))],
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
    final data = await ApiService().cancelOvertime(ot.id);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Icon(data['success'] == true ? Icons.check_circle_rounded : Icons.error_rounded,
            color: Colors.white, size: 18),
        const SizedBox(width: 10),
        Text(data['success'] == true ? 'Pengajuan berhasil dibatalkan' : (data['message'] ?? 'Gagal')),
      ]),
      backgroundColor: data['success'] == true ? AppColors.teal : AppColors.danger,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.all(16),
    ));
    if (data['success'] == true) widget.onRefresh();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final daysInMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    final firstWeekday = DateTime(_currentMonth.year, _currentMonth.month, 1).weekday % 7; // 0=Sun
    final monthLabel = DateFormat('MMMM yyyy', 'id_ID').format(_currentMonth);
    final isCurrentMonth = _currentMonth.month == now.month && _currentMonth.year == now.year;

    // Summary for current month
    final thisMonth = widget.overtimes.where((o) {
      final d = DateTime.parse(o.date);
      return d.month == _currentMonth.month && d.year == _currentMonth.year && o.status == 'approved';
    }).toList();
    final totalMins = thisMonth.fold<int>(0, (s, o) => s + o.durationMinutes);

    return RefreshIndicator(
      onRefresh: () async => widget.onRefresh(),
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
        children: [
          // --- Summary Card ---
          if (thisMonth.isNotEmpty) ...[
            Container(
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
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(DateFormat('MMMM', 'id_ID').format(_currentMonth),
                          style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w500)),
                    ),
                    const SizedBox(height: 6),
                    const Text('Total Lembur',
                        style: TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 2),
                    Text(
                      _formatDuration(totalMins),
                      style: const TextStyle(
                          color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5),
                    ),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  const Text('Sesi Disetujui',
                      style: TextStyle(color: Colors.white70, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text('${thisMonth.length}x',
                      style: const TextStyle(
                          color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
                ]),
              ]),
            ),
            const SizedBox(height: 16),
          ],

          // --- Calendar Card ---
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                // Month navigator
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: _prevMonth,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F5F5),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.chevron_left_rounded, size: 20, color: AppColors.textPrimary),
                        ),
                      ),
                      Text(
                        monthLabel,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      GestureDetector(
                        onTap: _nextMonth,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F5F5),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textPrimary),
                        ),
                      ),
                    ],
                  ),
                ),
                // Day-of-week headers
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
                        .map((d) => Expanded(
                              child: Center(
                                child: Text(d,
                                    style: const TextStyle(
                                        fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
                              ),
                            ))
                        .toList(),
                  ),
                ),
                const SizedBox(height: 4),
                // Calendar grid
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  child: Column(
                    children: _buildCalendarWeeks(daysInMonth, firstWeekday, now, isCurrentMonth),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // --- Selected day detail ---
          if (_selectedOvertime != null) ...[
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: _buildOvertimeDetail(_selectedOvertime!),
            ),
          ] else if (widget.overtimes.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.touch_app_rounded, size: 16, color: AppColors.textMuted.withValues(alpha: 0.5)),
                  const SizedBox(width: 8),
                  Text(
                    'Tap tanggal dengan lembur untuk melihat detail',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted.withValues(alpha: 0.7)),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 24),

          // --- Loading / Empty State ---
          if (widget.loading)
            Column(
                children: List.generate(
                    3,
                    (_) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: const ShimmerBox(width: double.infinity, height: 90, radius: 16),
                        )))
          else if (widget.overtimes.isEmpty)
            const EmptyState(
              icon: Icons.access_time_rounded,
              title: 'Belum ada pengajuan lembur',
              subtitle: 'Pengajuan lembur kamu\nakan muncul di sini',
            ),
        ],
      ),
    );
  }

  List<Widget> _buildCalendarWeeks(int daysInMonth, int firstWeekday, DateTime now, bool isCurrentMonth) {
    final today = now.day;
    final weeks = <Widget>[];
    final totalCells = firstWeekday + daysInMonth;
    final numWeeks = (totalCells / 7).ceil();

    int day = 1;
    for (int w = 0; w < numWeeks; w++) {
      final cells = <Widget>[];
      for (int d = 0; d < 7; d++) {
        final cellIdx = w * 7 + d;
        if (cellIdx < firstWeekday || day > daysInMonth) {
          cells.add(const Expanded(child: SizedBox(height: 44)));
        } else {
          final currentDay = day;
          final dayDate = DateTime(_currentMonth.year, _currentMonth.month, currentDay);
          final overtime = _overtimeOnDate(dayDate);
          final isToday = isCurrentMonth && currentDay == today;
          final isSelected = _selectedOvertime != null && _selectedOvertime!.date == DateFormat('yyyy-MM-dd').format(dayDate);

          cells.add(
            Expanded(
              child: GestureDetector(
                onTap: overtime != null
                    ? () => setState(() => _selectedOvertime = overtime)
                    : null,
                child: Container(
                  height: 44,
                  margin: const EdgeInsets.all(1.5),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFF8B1F1F).withValues(alpha: 0.15)
                        : overtime != null
                            ? _statusColor(overtime.status)?.withValues(alpha: 0.12)
                            : null,
                    borderRadius: BorderRadius.circular(10),
                    border: isToday
                        ? Border.all(color: const Color(0xFF8B1F1F), width: 1.5)
                        : null,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$currentDay',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isToday || overtime != null ? FontWeight.w700 : FontWeight.w500,
                          color: overtime != null
                              ? _statusColor(overtime.status) ?? AppColors.textPrimary
                              : isToday
                                  ? const Color(0xFF8B1F1F)
                                  : AppColors.textPrimary,
                        ),
                      ),
                      if (overtime != null)
                        Icon(
                          _statusIcon(overtime.status),
                          size: 8,
                          color: _statusColor(overtime.status),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          );
          day++;
        }
      }
      weeks.add(Row(children: cells));
    }
    return weeks;
  }

  Widget _buildOvertimeDetail(OvertimeModel ot) {
    final date = DateTime.parse(ot.date);
    final sc = _statusColor(ot.status);
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Header
        Row(children: [
          Icon(_statusIcon(ot.status), color: sc, size: 20),
          const SizedBox(width: 8),
          Text(
            DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(date),
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
          ),
          const Spacer(),
          StatusBadge(status: ot.status),
        ]),
        const SizedBox(height: 14),
        // Time
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFFBF5F5),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFF2D1D1)),
          ),
          child: Row(children: [
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Mulai', style: TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
              Text(
                ot.startTime.substring(0, 5),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF8B1F1F), letterSpacing: 0.5),
              ),
            ]),
            Expanded(
              child: Column(children: [
                const Icon(Icons.arrow_forward_rounded, size: 16, color: AppColors.textMuted),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B1F1F).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    ot.durationLabel,
                    style: const TextStyle(fontSize: 10, color: Color(0xFF8B1F1F), fontWeight: FontWeight.w700),
                  ),
                ),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              const Text('Selesai', style: TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
              Text(
                ot.endTime.substring(0, 5),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF8B1F1F), letterSpacing: 0.5),
              ),
            ]),
          ]),
        ),
        const SizedBox(height: 10),
        // Reason
        Text(ot.reason,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 12, height: 1.4),
            maxLines: 3, overflow: TextOverflow.ellipsis),
        if (ot.reviewNotes != null) ...[
          const SizedBox(height: 8),
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
                child: Text(ot.reviewNotes!,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4)),
              ),
            ]),
          ),
        ],
        if (ot.attachment != null) ...[
          const SizedBox(height: 10),
          ZoomableNetworkImage(
            url: '${AppConstants.uploadsUrl}/overtime/${ot.attachment}',
            heroTag: 'overtime-${ot.id}',
            height: 140,
            borderRadius: BorderRadius.circular(12),
          ),
        ],
        if (ot.canCancel) ...[
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => _cancel(context, ot),
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
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.danger)),
                ],
              ),
            ),
          ),
        ],
      ]),
    );
  }

  String _formatDuration(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h > 0 && m > 0) return '$h jam $m menit';
    if (h > 0) return '$h jam';
    return '$m menit';
  }
}


// ── FORM TAB ──────────────────────────────────────────────────────────────────
class _FormTab extends StatefulWidget {
  final VoidCallback onSubmit;
  const _FormTab({required this.onSubmit});
  @override
  State<_FormTab> createState() => _FormTabState();
}

class _FormTabState extends State<_FormTab> {
  final _reasonCtrl = TextEditingController();
  DateTime _date = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 17, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 19, minute: 0);
  File? _attachment;
  bool _loading = false;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  int get _durationMinutes {
    final startMins = _startTime.hour * 60 + _startTime.minute;
    final endMins = _endTime.hour * 60 + _endTime.minute;
    return endMins - startMins;
  }

  String get _durationLabel {
    final mins = _durationMinutes;
    if (mins <= 0) return 'Tidak valid';
    final h = mins ~/ 60;
    final m = mins % 60;
    if (h > 0 && m > 0) return '$h jam $m menit';
    if (h > 0) return '$h jam';
    return '$m menit';
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
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
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
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
      setState(() => isStart ? _startTime = picked : _endTime = picked);
    }
  }

  Future<void> _pickImage() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 16),
          const Text('Pilih Sumber Foto',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
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
        ]),
      ),
    );
    if (source == null) return;
    final img = await ImagePicker().pickImage(source: source, imageQuality: 80);
    if (img != null) setState(() => _attachment = File(img.path));
  }

  Future<void> _submit() async {
    if (_durationMinutes <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Jam selesai harus lebih dari jam mulai'),
        backgroundColor: AppColors.primary,
      ));
      return;
    }
    if (_reasonCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Alasan wajib diisi'),
        backgroundColor: AppColors.primary,
      ));
      return;
    }
    setState(() => _loading = true);
    try {
      final data = await ApiService().submitOvertime(
        DateFormat('yyyy-MM-dd').format(_date),
        '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}',
        '${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}',
        _reasonCtrl.text.trim(),
        attachment: _attachment,
      );
      if (!mounted) return;
      if (data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(data['message'] ?? 'Pengajuan berhasil dikirim'),
          backgroundColor: AppColors.teal,
        ));
        _reasonCtrl.clear();
        setState(() {
          _date = DateTime.now();
          _startTime = const TimeOfDay(hour: 17, minute: 0);
          _endTime = const TimeOfDay(hour: 19, minute: 0);
          _attachment = null;
        });
        widget.onSubmit();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(data['message'] ?? 'Gagal mengajukan'),
          backgroundColor: AppColors.primary,
        ));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Gagal mengajukan lembur'),
          backgroundColor: AppColors.primary,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        AppCard(
          padding: const EdgeInsets.all(20),
          radius: 18,
          hasShadow: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tanggal
              const Text('Tanggal Lembur',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickDate,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
                  ),
                  child: Row(children: [
                    const Icon(Icons.calendar_today_outlined,
                        size: 18, color: Color(0xFF8B1F1F)),
                    const SizedBox(width: 10),
                    Text(
                      DateFormat('EEEE, d MMMM yyyy', 'id_ID')
                          .format(_date),
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 16),

              // Jam
              const Text('Jam Lembur',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: _TimePicker(
                    label: 'Mulai',
                    time: _startTime,
                    onTap: () => _pickTime(true),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text('—',
                      style: TextStyle(
                          fontSize: 16,
                          color: AppColors.textMuted,
                          fontWeight: FontWeight.w500)),
                ),
                Expanded(
                  child: _TimePicker(
                    label: 'Selesai',
                    time: _endTime,
                    onTap: () => _pickTime(false),
                  ),
                ),
              ]),

              // Preview durasi
              if (_durationMinutes > 0) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF5F5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFEE2E2), width: 1),
                  ),
                  child: Row(children: [
                    const Icon(Icons.timer_outlined,
                        size: 14, color: Color(0xFF991B1B)),
                    const SizedBox(width: 6),
                    Text(
                      'Durasi: $_durationLabel',
                      style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF991B1B),
                          fontWeight: FontWeight.w700),
                    ),
                  ]),
                ),
              ] else if (_durationMinutes <= 0 &&
                  _startTime != const TimeOfDay(hour: 17, minute: 0)) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF8E1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFEF3C7), width: 1),
                  ),
                  child: const Row(children: [
                    Icon(Icons.warning_amber_rounded,
                        size: 14, color: AppColors.amber),
                    SizedBox(width: 6),
                    Text(
                      'Jam selesai harus lebih dari jam mulai',
                      style: TextStyle(
                          fontSize: 12,
                          color: AppColors.amber,
                          fontWeight: FontWeight.w600),
                    ),
                  ]),
                ),
              ],

              const SizedBox(height: 16),

              // Alasan
              const Text('Alasan / Pekerjaan yang Dilakukan',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              TextField(
                controller: _reasonCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Jelaskan pekerjaan yang dikerjakan saat lembur...',
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
              const SizedBox(height: 16),

              // Foto Bukti Lembur
              const Text('Foto Bukti Lembur',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary)),
              const SizedBox(height: 4),
              const Text('Opsional — foto aktivitas kerja, layar komputer, dll.',
                  style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
              const SizedBox(height: 8),
              if (_attachment == null)
                GestureDetector(
                  onTap: _pickImage,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9F9F9),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: const Color(0xFFE5E7EB),
                          width: 1),
                    ),
                    child: const Column(children: [
                      Icon(Icons.add_photo_alternate_outlined,
                          size: 34, color: AppColors.textMuted),
                      SizedBox(height: 8),
                      Text('Tambah Foto Bukti',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary)),
                      SizedBox(height: 4),
                      Text('Kamera atau Galeri · Maks 5MB',
                          style: TextStyle(
                              fontSize: 11, color: AppColors.textMuted)),
                    ]),
                  ),
                )
              else
                Stack(children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.file(
                      _attachment!,
                      width: double.infinity,
                      height: 180,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 8, right: 8,
                    child: GestureDetector(
                      onTap: () => setState(() => _attachment = null),
                      child: Container(
                        width: 30, height: 30,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.6),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, color: Colors.white, size: 16),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 0, left: 0, right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(14)),
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [Colors.black.withValues(alpha: 0.6), Colors.transparent],
                        ),
                      ),
                      child: const Row(children: [
                        Icon(Icons.check_circle_rounded, color: Colors.white, size: 14),
                        SizedBox(width: 6),
                        Text('Foto terlampir',
                            style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  ),
                ]),
              const SizedBox(height: 24),
              PrimaryButton(
                text: 'Kirim Pengajuan Lembur',
                onPressed: _durationMinutes > 0 ? _submit : null,
                isLoading: _loading,
                icon: Icons.send_rounded,
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME PICKER — Desain baru merah/pink muda transparan
// ─────────────────────────────────────────────────────────────────────────────
class _TimePicker extends StatelessWidget {
  final String label;
  final TimeOfDay time;
  final VoidCallback onTap;
  const _TimePicker({required this.label, required this.time, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 18),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF5F5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFEE2E2), width: 1),
      ),
      child: Column(children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Color(0xFF991B1B), fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        Text(
          '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFF7F1D1D),
            letterSpacing: 0.5,
          ),
        ),
      ]),
    ),
  );
}
