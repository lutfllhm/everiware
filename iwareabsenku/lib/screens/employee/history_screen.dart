import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../services/realtime_service.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/animations.dart';

/// Unified history screen showing all leave + overtime requests
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  // Attendance states
  List<AttendanceModel> _attendances = [];
  bool _attLoading = true;
  int _selectedMonth = DateTime.now().month;
  int _selectedYear = DateTime.now().year;
  String _filterStatus = 'all';

  // Leave & Overtime states
  List<LeaveModel> _leaves = [];
  List<OvertimeModel> _overtimes = [];
  bool _leavesOvertimesLoading = true;
  StreamSubscription? _realtimeSub;

  final _months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _loadAttendance();
    _loadLeavesOvertimes();

    _realtimeSub = RealtimeService().events.listen((event) {
      final evName = event['event'];
      if (evName == 'attendance_update') {
        _loadAttendance();
      } else if (evName == 'leave_update' || evName == 'overtime_update') {
        _loadLeavesOvertimes();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAttendance() async {
    if (!mounted) return;
    setState(() => _attLoading = true);
    try {
      final data = await ApiService().getMyAttendance(
          month: _selectedMonth, year: _selectedYear);
      if (mounted) {
        setState(() {
          _attendances = (data['attendances'] as List? ?? [])
              .map((a) => AttendanceModel.fromJson(a))
              .toList();
          _attLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _attLoading = false);
    }
  }

  Future<void> _loadLeavesOvertimes() async {
    if (!mounted) return;
    setState(() => _leavesOvertimesLoading = true);
    try {
      final results = await Future.wait([
        ApiService().getMyLeaves(),
        ApiService().getMyOvertime(),
      ]);
      if (mounted) {
        setState(() {
          _leaves = (results[0]['leaves'] as List? ?? [])
              .map((l) => LeaveModel.fromJson(l))
              .toList();
          _overtimes = (results[1]['overtimes'] as List? ?? [])
              .map((o) => OvertimeModel.fromJson(o))
              .toList();
          _leavesOvertimesLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _leavesOvertimesLoading = false);
    }
  }

  Future<void> _cancelLeave(LeaveModel leave) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Batalkan Pengajuan',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: const Text('Apakah kamu yakin ingin membatalkan pengajuan ini?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
              child: const Text('Tidak')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Ya, Batalkan'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final res = await ApiService().cancelLeave(leave.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['success'] == true ? 'Pengajuan dibatalkan ✅' : 'Gagal membatalkan'),
          backgroundColor: res['success'] == true ? AppColors.teal : AppColors.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ));
        if (res['success'] == true) _loadLeavesOvertimes();
      }
    } catch (_) {}
  }

  List<AttendanceModel> get _filteredAttendances {
    if (_filterStatus == 'all') return _attendances;
    return _attendances.where((a) => a.status == _filterStatus).toList();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: NestedScrollView(
        headerSliverBuilder: (_, __) => [
          SliverToBoxAdapter(child: _buildHeroHeader()),
        ],
        body: TabBarView(
          controller: _tabCtrl,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            _buildAttendanceTab(),
            _buildLeaveOvertimeTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroHeader() {
    final user = context.watch<AuthProvider>().user;
    return ProfileHeader(
      title: 'Riwayat Absensi',
      name: user?.name,
      position: user?.position ?? user?.roleLabel,
      department: user?.department ?? user?.deptPosition,
      avatarFilename: user?.avatar,
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
          Tab(text: 'Absensi'),
          Tab(text: 'Izin & Lembur'),
        ],
      ),
    );
  }

  Widget _buildStatsCard(int present, int lateCount, int absent, int leave, int sick) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow(),
      ),
      child: Row(
        children: [
          _StatItem(value: '$present', label: 'Hadir', color: AppColors.success),
          _buildVerticalDivider(),
          _StatItem(value: '$lateCount', label: 'Terlambat', color: AppColors.amber),
          _buildVerticalDivider(),
          _StatItem(value: '$absent', label: 'Absen', color: AppColors.danger),
          _buildVerticalDivider(),
          _StatItem(value: '$leave', label: 'Cuti', color: AppColors.sky),
          _buildVerticalDivider(),
          _StatItem(value: '$sick', label: 'Sakit', color: const Color(0xFF8B5CF6)),
        ],
      ),
    );
  }

  Widget _buildVerticalDivider() => Container(
        height: 24,
        width: 1,
        color: AppColors.border,
      );

  Widget _buildAttendanceTab() {
    int present  = _attendances.where((a) => a.status == 'present').length;
    int lateCount = _attendances.where((a) => a.status == 'late').length;
    int absent   = _attendances.where((a) => a.status == 'absent').length;
    int leave    = _attendances.where((a) => a.status == 'leave').length;
    int sick     = _attendances.where((a) => a.status == 'sick').length;

    return RefreshIndicator(
      onRefresh: _loadAttendance,
      color: const Color(0xFF8B1F1F),
      child: CustomScrollView(
        key: const PageStorageKey('attendance_history_tab'),
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              children: [
                // Month/Year dropdown filters
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: _DropdownBox(
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<int>(
                              value: _selectedMonth,
                              isDense: true,
                              isExpanded: true,
                              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: AppColors.textMuted),
                              items: List.generate(12, (i) => DropdownMenuItem(
                                value: i + 1,
                                child: Text(_months[i], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                              )),
                              onChanged: (v) {
                                if (v != null) {
                                  setState(() => _selectedMonth = v);
                                  _loadAttendance();
                                }
                              },
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      _DropdownBox(
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            value: _selectedYear,
                            isDense: true,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: AppColors.textMuted),
                            items: [2024, 2025, 2026].map((y) => DropdownMenuItem(
                              value: y,
                              child: Text('$y', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                            )).toList(),
                            onChanged: (v) {
                              if (v != null) {
                                  setState(() => _selectedYear = v);
                                  _loadAttendance();
                              }
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Stats Card
                if (!_attLoading && _attendances.isNotEmpty)
                  _buildStatsCard(present, lateCount, absent, leave, sick),

                // Status Chips filter
                if (!_attLoading && _attendances.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          _FilterChip(
                            label: 'Semua',
                            count: _attendances.length,
                            color: const Color(0xFF8B1F1F),
                            active: _filterStatus == 'all',
                            onTap: () => setState(() => _filterStatus = 'all'),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'Hadir',
                            count: present,
                            color: AppColors.teal,
                            active: _filterStatus == 'present',
                            onTap: () => setState(() => _filterStatus = 'present'),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'Terlambat',
                            count: lateCount,
                            color: AppColors.amber,
                            active: _filterStatus == 'late',
                            onTap: () => setState(() => _filterStatus == 'late'),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'Absen',
                            count: absent,
                            color: AppColors.danger,
                            active: _filterStatus == 'absent',
                            onTap: () => setState(() => _filterStatus == 'absent'),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'Cuti',
                            count: leave,
                            color: AppColors.sky,
                            active: _filterStatus == 'leave',
                            onTap: () => setState(() => _filterStatus == 'leave'),
                          ),
                          const SizedBox(width: 8),
                          _FilterChip(
                            label: 'Sakit',
                            count: sick,
                            color: const Color(0xFF8B5CF6),
                            active: _filterStatus == 'sick',
                            onTap: () => setState(() => _filterStatus == 'sick'),
                          ),
                        ],
                      ),
                    ),
                  ),
                const Divider(height: 1, color: AppColors.divider),
              ],
            ),
          ),
          
          // Attendances List
          if (_attLoading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_filteredAttendances.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(
                icon: Icons.event_busy_outlined,
                title: 'Tidak ada data',
                subtitle: 'Tidak ada absensi untuk\nfilter yang dipilih',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: FadeSlideIn(
                      delay: Duration(milliseconds: 30 * i),
                      child: _AttendanceItem(att: _filteredAttendances[i]),
                    ),
                  ),
                  childCount: _filteredAttendances.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildLeaveOvertimeTab() {
    return RefreshIndicator(
      onRefresh: _loadLeavesOvertimes,
      color: const Color(0xFF8B1F1F),
      child: CustomScrollView(
        key: const PageStorageKey('leave_overtime_history_tab'),
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                if (_leavesOvertimesLoading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 60),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  if (_leaves.isEmpty && _overtimes.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 60),
                      child: Column(children: [
                        Icon(Icons.inbox_rounded, size: 48, color: AppColors.textMuted.withValues(alpha: 0.4)),
                        const SizedBox(height: 12),
                        const Text('Belum ada pengajuan', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
                        const SizedBox(height: 4),
                        const Text('Pengajuan izin, cuti, dan lembur akan muncul di sini', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
                      ]),
                    )
                  else ...[
                    if (_leaves.isNotEmpty) ...[
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(children: [
                          Container(
                            width: 4, height: 16,
                            decoration: BoxDecoration(color: const Color(0xFF8B1F1F), borderRadius: BorderRadius.circular(2)),
                          ),
                          const SizedBox(width: 8),
                          const Text('Izin & Cuti', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                          const Spacer(),
                          Text('${_leaves.length} pengajuan', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        ]),
                      ),
                      ...(_leaves.map((leave) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: FadeSlideIn(
                          child: _LeaveRequestCard(
                            leave: leave,
                            onCancel: leave.canCancel ? () => _cancelLeave(leave) : null,
                          ),
                        ),
                      ))),
                    ],
                    if (_leaves.isNotEmpty && _overtimes.isNotEmpty)
                      const SizedBox(height: 8),
                    if (_overtimes.isNotEmpty) ...[
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(children: [
                          Container(
                            width: 4, height: 16,
                            decoration: BoxDecoration(color: const Color(0xFFFF9100), borderRadius: BorderRadius.circular(2)),
                          ),
                          const SizedBox(width: 8),
                          const Text('Lembur', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                          const Spacer(),
                          Text('${_overtimes.length} pengajuan', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                        ]),
                      ),
                      ...(_overtimes.map((ot) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: FadeSlideIn(
                          child: _OvertimeRequestCard(overtime: ot),
                        ),
                      ))),
                    ],
                  ],
                ],
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Leave Request Card ─────────────────────────────────────────────────────────
class _LeaveRequestCard extends StatelessWidget {
  final LeaveModel leave;
  final VoidCallback? onCancel;
  const _LeaveRequestCard({required this.leave, this.onCancel});

  static const _typeMap = {
    'annual':         {'color': Color(0xFF8B1F1F), 'bg': Color(0xFFFFEBEE), 'label': 'Cuti Tahunan'},
    'sick':           {'color': Color(0xFF0284C7), 'bg': Color(0xFFF0F9FF), 'label': 'Izin Sakit'},
    'wfh':            {'color': Color(0xFF0D9488), 'bg': Color(0xFFF0FDFA), 'label': 'WFH'},
    'dinas':          {'color': Color(0xFFD97706), 'bg': Color(0xFFFFFBEB), 'label': 'Dinas Luar'},
    'permission':     {'color': Color(0xFF7C3AED), 'bg': Color(0xFFF5F3FF), 'label': 'Izin'},
    'late_permission':{'color': Color(0xFF2E7D32), 'bg': Color(0xFFF0FDF4), 'label': 'Izin Terlambat'},
    'early_leave':    {'color': Color(0xFFFFB300), 'bg': Color(0xFFFFF8E1), 'label': 'Izin Pulang Cepat'},
    'leave_office':   {'color': Color(0xFFE040FB), 'bg': Color(0xFFFCE4EC), 'label': 'Izin Keluar Kantor'},
  };

  @override
  Widget build(BuildContext context) {
    final cfg = _typeMap[leave.type] ?? {'color': AppColors.primary, 'bg': AppColors.primaryBg, 'label': leave.typeLabel};
    final typeColor = cfg['color'] as Color;
    final typeBg    = cfg['bg'] as Color;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow(),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 5,
                color: typeColor,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: typeBg, borderRadius: BorderRadius.circular(20)),
                        child: Text(
                          cfg['label'] as String,
                          style: TextStyle(color: typeColor, fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                      ),
                      const Spacer(),
                      StatusBadge(status: leave.status),
                    ]),
                    const SizedBox(height: 12),
                    Text(
                      leave.reason,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: AppColors.textPrimary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 10),
                    Row(children: [
                      Icon(Icons.date_range_rounded, size: 14, color: typeColor),
                      const SizedBox(width: 6),
                      Text(
                        '${DateFormat('d MMM', 'id_ID').format(DateTime.parse(leave.startDate))} – '
                        '${DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(leave.endDate))}',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: typeBg, borderRadius: BorderRadius.circular(8)),
                        child: Text(
                          '${leave.totalDays} hari',
                          style: TextStyle(fontSize: 11, color: typeColor, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ]),
                    if (leave.reviewNotes != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.grey50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Icon(Icons.chat_bubble_outline_rounded, size: 13, color: AppColors.textMuted),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(leave.reviewNotes!,
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4)),
                          ),
                        ]),
                      ),
                    ],
                    if (onCancel != null) ...[
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: onCancel,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.dangerBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.cancel_outlined, size: 14, color: AppColors.danger),
                              SizedBox(width: 6),
                              Text('Batalkan Pengajuan',
                                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.danger)),
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

// ── Overtime Request Card ──────────────────────────────────────────────────────
class _OvertimeRequestCard extends StatelessWidget {
  final OvertimeModel overtime;
  const _OvertimeRequestCard({required this.overtime});

  @override
  Widget build(BuildContext context) {
    const overtimeColor = Color(0xFFFF9100);
    const overtimeBg = Color(0xFFFFF8E1);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow(),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 5,
                color: overtimeColor,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: overtimeBg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text('Lembur',
                            style: TextStyle(color: overtimeColor, fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                      const Spacer(),
                      StatusBadge(status: overtime.status),
                    ]),
                    const SizedBox(height: 12),
                    Text(
                      overtime.reason,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: AppColors.textPrimary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 10),
                    Row(children: [
                      const Icon(Icons.date_range_rounded, size: 14, color: overtimeColor),
                      const SizedBox(width: 6),
                      Text(
                        DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(overtime.date)),
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: overtimeBg,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${overtime.durationMinutes ~/ 60} jam ${overtime.durationMinutes % 60} mnt',
                          style: const TextStyle(fontSize: 11, color: overtimeColor, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 8),
                    Row(children: [
                      const Icon(Icons.schedule_rounded, size: 14, color: AppColors.textMuted),
                      const SizedBox(width: 6),
                      Text(
                        '${overtime.startTime} – ${overtime.endTime}',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                    ]),
                    if (overtime.reviewNotes != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.grey50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Icon(Icons.chat_bubble_outline_rounded, size: 13, color: AppColors.textMuted),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(overtime.reviewNotes!,
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4)),
                          ),
                        ]),
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPER WIDGETS FOR ATTENDANCE TAB
// ─────────────────────────────────────────────────────────────────────────────
class _DropdownBox extends StatelessWidget {
  final Widget child;
  const _DropdownBox({required this.child});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.border, width: 1.2),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.03),
          blurRadius: 6,
          offset: const Offset(0, 2),
        ),
      ],
    ),
    child: child,
  );
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final bool active;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label, required this.count, required this.color,
    required this.active, required this.onTap,
  });

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            gradient: active ? LinearGradient(
              colors: [color, color.withValues(alpha: 0.85)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ) : null,
            color: active ? null : color.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(20),
            boxShadow: active ? AppColors.glowShadow(color, alpha: 0.15) : [],
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w700,
              color: active ? Colors.white : color)),
            const SizedBox(width: 6),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: active ? Colors.white.withValues(alpha: 0.2)
                    : color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$count', style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w800,
                color: active ? Colors.white : color)),
            ),
          ]),
        ),
      ),
    ),
  );
}

class _StatItem extends StatelessWidget {
  final String value, label;
  final Color color;
  const _StatItem({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 18,
            fontWeight: FontWeight.w800,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _AttendanceItem extends StatelessWidget {
  final AttendanceModel att;
  const _AttendanceItem({required this.att});

  Color _getStatusColor(String status) {
    switch (status) {
      case 'present':
        return AppColors.success;
      case 'late':
        return AppColors.warning;
      case 'absent':
        return AppColors.danger;
      case 'leave':
        return AppColors.sky;
      case 'sick':
        return const Color(0xFF8B5CF6);
      default:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final date = DateTime.parse(att.date);
    final statusColor = _getStatusColor(att.status);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow(),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 5,
                color: statusColor,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 42,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text(
                              DateFormat('d').format(date),
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                                height: 1.0,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              DateFormat('MMM', 'id_ID').format(date).toUpperCase(),
                              style: const TextStyle(
                                fontSize: 10,
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              DateFormat('EEEE', 'id_ID').format(date),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14.5,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                _TimeTag(
                                  icon: Icons.login_rounded,
                                  time: att.checkIn != null
                                      ? DateFormat('HH:mm').format(att.checkIn!)
                                      : '--:--',
                                  color: att.checkIn != null ? AppColors.success : AppColors.textMuted,
                                ),
                                const SizedBox(width: 10),
                                _TimeTag(
                                  icon: Icons.logout_rounded,
                                  time: att.checkOut != null
                                      ? DateFormat('HH:mm').format(att.checkOut!)
                                      : '--:--',
                                  color: att.checkOut != null ? AppColors.primary : AppColors.textMuted,
                                ),
                              ],
                            ),
                            if (att.locationName != null) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.location_on_outlined, size: 12, color: AppColors.textMuted),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      att.locationName!,
                                      style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      StatusBadge(status: att.status),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TimeTag extends StatelessWidget {
  final IconData icon;
  final String time;
  final Color color;
  const _TimeTag({required this.icon, required this.time, required this.color});

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 12, color: color),
    const SizedBox(width: 3),
    Text(time, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
  ]);
}