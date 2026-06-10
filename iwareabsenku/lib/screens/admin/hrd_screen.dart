import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../services/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../models/user_model.dart';
import '../../services/realtime_service.dart';

class HrdScreen extends StatefulWidget {
  const HrdScreen({super.key});
  @override
  State<HrdScreen> createState() => _HrdScreenState();
}

class _HrdScreenState extends State<HrdScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  int _unreadPending = 0;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _fetchPendingCount();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'leave_update') {
        _fetchPendingCount();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchPendingCount() async {
    try {
      final data = await ApiService().getAllPendingLeaves();
      final leaves = data['leaves'] as List? ?? [];
      if (mounted) setState(() => _unreadPending = leaves.length);
    } catch (_) {}
  }

  Future<void> _logout() async {
    HapticFeedback.mediumImpact();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Keluar dari Akun?', style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text('Kamu perlu login ulang setelah keluar.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Keluar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      await context.read<AuthProvider>().logout();
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: NestedScrollView(
          headerSliverBuilder: (_, __) => [
            SliverToBoxAdapter(child: _buildHeader(user)),
          ],
          body: Column(children: [
            // Tab bar
            Container(
              color: Colors.white,
              child: TabBar(
                controller: _tabCtrl,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textMuted,
                indicatorColor: AppColors.primary,
                indicatorWeight: 3,
                labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                tabs: [
                  Tab(text: 'Pengajuan${_unreadPending > 0 ? " ($_unreadPending)" : ""}'),
                  const Tab(text: 'Absensi'),
                  const Tab(text: 'Kalender'),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                controller: _tabCtrl,
                children: [
                  _PendingLeavesTab(onRefresh: _fetchPendingCount),
                  const _TodayAttendanceTab(),
                  const _TeamCalendarTab(),
                ],
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildHeader(UserModel? user) => Container(
    decoration: const BoxDecoration(gradient: AppColors.primaryGradient),
    child: SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 8)]),
            child: ClipRRect(borderRadius: BorderRadius.circular(12),
              child: Image.asset('assets/images/iwaa.png', fit: BoxFit.contain)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(user?.roleLabel ?? 'HRD', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 11)),
            Text(user?.name ?? '', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
          ])),
          if (_unreadPending > 0)
            Container(
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.pending_actions_rounded, color: Colors.white, size: 14),
                const SizedBox(width: 4),
                Text('$_unreadPending pending', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
              ]),
            ),
          GestureDetector(
            onTap: _logout,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.logout_rounded, color: Colors.white, size: 18),
            ),
          ),
        ]),
      ),
    ),
  );
}

// ------------------------------------------
// TAB 1: PENGAJUAN PENDING
// ------------------------------------------
class _PendingLeavesTab extends StatefulWidget {
  final VoidCallback onRefresh;
  const _PendingLeavesTab({required this.onRefresh});
  @override
  State<_PendingLeavesTab> createState() => _PendingLeavesTabState();
}

class _PendingLeavesTabState extends State<_PendingLeavesTab> {
  List<Map<String, dynamic>> _leaves = [];
  bool _loading = true;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _load();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'leave_update') {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getAllPendingLeaves();
      if (mounted) setState(() {
        _leaves = (data['leaves'] as List? ?? []).map((l) => Map<String, dynamic>.from(l)).toList();
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  void _openReview(Map<String, dynamic> leave) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReviewSheet(
        leave: leave,
        onDone: () { _load(); widget.onRefresh(); },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    if (_leaves.isEmpty) return const EmptyState(
      icon: Icons.check_circle_outline_rounded,
      title: 'Tidak ada pengajuan pending',
      subtitle: 'Semua pengajuan sudah diproses',
    );

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        itemCount: _leaves.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final l = _leaves[i];
          final start = DateTime.parse(l['start_date'] as String);
          final end   = DateTime.parse(l['end_date'] as String);
          return AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Header karyawan
              Row(children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(gradient: AppColors.primaryGradient, borderRadius: BorderRadius.circular(12)),
                  child: Center(child: Text(
                    ((l['user_name'] as String? ?? '?')[0]).toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                  )),
                ),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l['user_name'] ?? '-', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                  Text(
                    [l['department'], l['position'], l['employee_id']].where((v) => v != null && v.toString().isNotEmpty).join('  -  ').isEmpty
                        ? '-'
                        : [l['department'], l['position'], l['employee_id']].where((v) => v != null && v.toString().isNotEmpty).join('  -  '),                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                ])),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.amber100, borderRadius: BorderRadius.circular(8)),
                  child: Text(l['type'] ?? '-',
                      style: const TextStyle(fontSize: 11, color: AppColors.amber, fontWeight: FontWeight.w600)),
                ),
              ]),
              const SizedBox(height: 12),
              // Info
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.grey50, borderRadius: BorderRadius.circular(10)),
                child: Column(children: [
                  _InfoRow(Icons.calendar_today_outlined,
                    '${DateFormat('d MMM yyyy', 'id_ID').format(start)}  -  ${DateFormat('d MMM yyyy', 'id_ID').format(end)}'),
                  const SizedBox(height: 6),
                  _InfoRow(Icons.access_time_rounded, '${l['total_days']} hari kerja'),
                  const SizedBox(height: 6),
                  _InfoRow(Icons.notes_rounded, l['reason'] ?? '-'),
                ]),
              ),
              const SizedBox(height: 12),
              // Tombol aksi
              Row(children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _openReview(l),
                    icon: const Icon(Icons.close_rounded, size: 16),
                    label: const Text('Tolak'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _quickApprove(l),
                    icon: const Icon(Icons.check_rounded, size: 16),
                    label: const Text('Setujui'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.teal,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ]),
            ]),
          );
        },
      ),
    );
  }

  Future<void> _quickApprove(Map<String, dynamic> leave) async {
    HapticFeedback.lightImpact();
    final data = await ApiService().reviewLeave(leave['id'] as String, 'approved');
    if (!mounted) return;
    if (data['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Pengajuan disetujui ?'), backgroundColor: AppColors.teal,
      ));
      _load(); widget.onRefresh();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data['message'] ?? 'Gagal'), backgroundColor: AppColors.primary,
      ));
    }
  }
}

// -- Review Bottom Sheet -------------------------------------------------------
class _ReviewSheet extends StatefulWidget {
  final Map<String, dynamic> leave;
  final VoidCallback onDone;
  const _ReviewSheet({required this.leave, required this.onDone});
  @override
  State<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<_ReviewSheet> {
  final _notesCtrl = TextEditingController();
  bool _loading = false;
  String _action = 'rejected'; // default tolak karena approve ada quick button

  @override
  void dispose() { _notesCtrl.dispose(); super.dispose(); }

  Future<void> _submit() async {
    if (_action == 'rejected' && _notesCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Catatan wajib diisi saat menolak'), backgroundColor: AppColors.primary,
      ));
      return;
    }
    setState(() => _loading = true);
    final data = await ApiService().reviewLeave(
      widget.leave['id'] as String, _action,
      notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
    );
    if (!mounted) return;
    setState(() => _loading = false);
    if (data['success'] == true) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(_action == 'approved' ? 'Pengajuan disetujui ?' : 'Pengajuan ditolak ?'),
        backgroundColor: _action == 'approved' ? AppColors.teal : AppColors.primary,
      ));
      widget.onDone();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data['message'] ?? 'Gagal'), backgroundColor: AppColors.primary,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.leave;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 16),
        Text('Review Pengajuan', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Text(l['user_name'] ?? '-', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
        const SizedBox(height: 16),

        // Pilih aksi
        Row(children: [
          Expanded(child: GestureDetector(
            onTap: () => setState(() => _action = 'approved'),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: _action == 'approved' ? AppColors.teal : AppColors.grey100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.check_rounded, color: _action == 'approved' ? Colors.white : AppColors.textMuted, size: 18),
                const SizedBox(width: 6),
                Text('Setujui', style: TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 14,
                  color: _action == 'approved' ? Colors.white : AppColors.textMuted,
                )),
              ]),
            ),
          )),
          const SizedBox(width: 10),
          Expanded(child: GestureDetector(
            onTap: () => setState(() => _action = 'rejected'),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: _action == 'rejected' ? AppColors.primary : AppColors.grey100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.close_rounded, color: _action == 'rejected' ? Colors.white : AppColors.textMuted, size: 18),
                const SizedBox(width: 6),
                Text('Tolak', style: TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 14,
                  color: _action == 'rejected' ? Colors.white : AppColors.textMuted,
                )),
              ]),
            ),
          )),
        ]),
        const SizedBox(height: 14),

        TextField(
          controller: _notesCtrl,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: _action == 'rejected' ? 'Alasan penolakan (wajib)...' : 'Catatan tambahan (opsional)...',
            filled: true, fillColor: AppColors.grey100,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 14),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: _action == 'approved' ? AppColors.teal : AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _loading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text(_action == 'approved' ? 'Setujui Pengajuan' : 'Tolak Pengajuan',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          ),
        ),
      ]),
    );
  }
}

// ------------------------------------------
// TAB 2: ABSENSI HARI INI
// ------------------------------------------
class _TodayAttendanceTab extends StatefulWidget {
  const _TodayAttendanceTab();
  @override
  State<_TodayAttendanceTab> createState() => _TodayAttendanceTabState();
}

class _TodayAttendanceTabState extends State<_TodayAttendanceTab> {
  List<Map<String, dynamic>> _all = [];
  bool _loading = true;
  String _filter = 'all';
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _load();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'attendance_update') {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getTodayAllAttendance();
      if (mounted) setState(() {
        final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
        _all = (data['attendances'] as List? ?? [])
            .map((a) => Map<String, dynamic>.from(a))
            .where((a) => a['date'] == today)
            .toList();
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'all') return _all;
    return _all.where((a) => a['status'] == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final present = _all.where((a) => a['status'] == 'present').length;
    final late    = _all.where((a) => a['status'] == 'late').length;
    final absent  = _all.where((a) => a['status'] == 'absent').length;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: [
                // Summary chips
                Row(children: [
                  _SummaryChip(label: 'Hadir', value: present, color: AppColors.teal, onTap: () => setState(() => _filter = _filter == 'present' ? 'all' : 'present'), active: _filter == 'present'),
                  const SizedBox(width: 8),
                  _SummaryChip(label: 'Terlambat', value: late, color: AppColors.amber, onTap: () => setState(() => _filter = _filter == 'late' ? 'all' : 'late'), active: _filter == 'late'),
                  const SizedBox(width: 8),
                  _SummaryChip(label: 'Absen', value: absent, color: AppColors.primary, onTap: () => setState(() => _filter = _filter == 'absent' ? 'all' : 'absent'), active: _filter == 'absent'),
                ]),
                const SizedBox(height: 14),

                if (_filtered.isEmpty)
                  const EmptyState(icon: Icons.event_busy_outlined, title: 'Tidak ada data', subtitle: 'Belum ada absensi hari ini')
                else
                  AppCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: _filtered.asMap().entries.map((e) {
                        final att = e.value;
                        final isLast = e.key == _filtered.length - 1;
                        final checkIn  = att['check_in']  != null ? DateFormat('HH:mm').format(DateTime.parse(att['check_in']  as String)) : '--:--';
                        final checkOut = att['check_out'] != null ? DateFormat('HH:mm').format(DateTime.parse(att['check_out'] as String)) : '--:--';
                        return Column(children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            child: Row(children: [
                              Container(
                                width: 38, height: 38,
                                decoration: BoxDecoration(color: AppColors.grey100, borderRadius: BorderRadius.circular(10)),
                                child: Center(child: Text(
                                  ((att['user_name'] as String? ?? '?')[0]).toUpperCase(),
                                  style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.textSecondary),
                                )),
                              ),
                              const SizedBox(width: 10),
                              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(att['user_name'] ?? '-', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
                                Text(
                                  [att['department'], att['position']].where((v) => v != null && v.toString().isNotEmpty).isNotEmpty
                                      ? [att['department'], att['position']].where((v) => v != null && v.toString().isNotEmpty).join('  -  ')
                                      : '$checkIn  -  $checkOut',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                ),
                                if ([att['department'], att['position']].any((v) => v != null && v.toString().isNotEmpty))
                                  Text('$checkIn  -  $checkOut', style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                              ])),
                              StatusBadge(status: att['status'] ?? 'present'),
                            ]),
                          ),
                          if (!isLast) const Divider(height: 1, indent: 64, color: AppColors.divider),
                        ]);
                      }).toList(),
                    ),
                  ),
              ],
            ),
    );
  }
}

// ------------------------------------------
// TAB 3: KALENDER TIM
// ------------------------------------------
class _TeamCalendarTab extends StatefulWidget {
  const _TeamCalendarTab();
  @override
  State<_TeamCalendarTab> createState() => _TeamCalendarTabState();
}

class _TeamCalendarTabState extends State<_TeamCalendarTab> {
  List<dynamic> _onLeave = [];
  bool _loading = true;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _load();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'leave_update') {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getTeamCalendar();
      if (mounted) setState(() {
        _onLeave = data['onLeave'] as List? ?? [];
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    if (_onLeave.isEmpty) return const EmptyState(
      icon: Icons.event_available_outlined,
      title: 'Tidak ada izin/cuti',
      subtitle: 'Tidak ada karyawan yang sedang\nizin atau cuti minggu ini',
    );

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        itemCount: _onLeave.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final l = _onLeave[i] as Map<String, dynamic>;
          final start = DateTime.parse(l['start_date'] as String);
          final end   = DateTime.parse(l['end_date'] as String);
          return AppCard(
            child: Row(children: [
              Container(
                width: 42, height: 42,
                decoration: BoxDecoration(gradient: AppColors.primaryGradient, borderRadius: BorderRadius.circular(12)),
                child: Center(child: Text(
                  ((l['name'] as String? ?? '?')[0]).toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                )),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(l['name'] ?? '-', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                Text(
                  [l['department'], l['position']].where((v) => v != null && v.toString().isNotEmpty).isNotEmpty
                      ? [l['department'], l['position']].where((v) => v != null && v.toString().isNotEmpty).join('  -  ')
                      : '-',
                  style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
                const SizedBox(height: 4),
                Text(
                  '${DateFormat('d MMM', 'id_ID').format(start)}  -  ${DateFormat('d MMM', 'id_ID').format(end)}  -  ${l['total_days']} hari',
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
              ])),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: AppColors.primaryBg, borderRadius: BorderRadius.circular(8)),
                child: Text(l['type_label'] ?? l['type'] ?? '-',
                    style: const TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600)),
              ),
            ]),
          );
        },
      ),
    );
  }
}

// -- Helper Widgets ------------------------------------------------------------
class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow(this.icon, this.text);
  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Icon(icon, size: 14, color: AppColors.textMuted),
    const SizedBox(width: 6),
    Expanded(child: Text(text, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4))),
  ]);
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  final VoidCallback onTap;
  final bool active;
  const _SummaryChip({required this.label, required this.value, required this.color, required this.onTap, required this.active});

  @override
  Widget build(BuildContext context) => Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: active ? color : color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(children: [
          Text('$value', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: active ? Colors.white : color)),
          Text(label, style: TextStyle(fontSize: 10, color: active ? Colors.white70 : color, fontWeight: FontWeight.w500)),
        ]),
      ),
    ),
  );
}


