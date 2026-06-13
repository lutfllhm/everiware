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
import '../../utils/constants.dart';
import '../../services/realtime_service.dart';

class AdminHistoryTab extends StatefulWidget {
  const AdminHistoryTab({super.key});

  @override
  State<AdminHistoryTab> createState() => _AdminHistoryTabState();
}

class _AdminHistoryTabState extends State<AdminHistoryTab> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F8FD),
        body: NestedScrollView(
          headerSliverBuilder: (_, __) => [
            SliverToBoxAdapter(
              child: ProfileHeader(
                title: 'Riwayat',
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
                    Tab(text: 'Izin & Cuti'),
                    Tab(text: 'Lembur'),
                  ],
                ),
              ),
            ),
          ],
          body: TabBarView(
            controller: _tabCtrl,
            physics: const NeverScrollableScrollPhysics(),
            children: const [
              _LeaveHistorySubTab(),
              _OvertimeHistorySubTab(),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-TAB: RIWAYAT IZIN & CUTI
// ─────────────────────────────────────────────────────────────────────────────
class _LeaveHistorySubTab extends StatefulWidget {
  const _LeaveHistorySubTab();

  @override
  State<_LeaveHistorySubTab> createState() => _LeaveHistorySubTabState();
}

class _LeaveHistorySubTabState extends State<_LeaveHistorySubTab> {
  List<Map<String, dynamic>> _leaves = [];
  bool _loading = true;
  String _statusFilter = 'all'; // all, pending, approved, rejected
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
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final data = await ApiService().getAllLeaves();
      if (mounted) {
        setState(() {
          _leaves = (data['leaves'] as List? ?? []).map((l) => Map<String, dynamic>.from(l)).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredLeaves {
    if (_statusFilter == 'all') return _leaves;
    return _leaves.where((l) => l['status'] == _statusFilter).toList();
  }

  void _openReview(Map<String, dynamic> leave) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LeaveReviewSheet(
        leave: leave,
        onDone: _load,
      ),
    );
  }

  Future<void> _quickApprove(Map<String, dynamic> leave) async {
    HapticFeedback.lightImpact();
    final data = await ApiService().reviewLeave(leave['id'] as String, 'approved');
    if (!mounted) return;
    if (data['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Pengajuan disetujui ✅'),
        backgroundColor: AppColors.teal,
      ));
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data['message'] ?? 'Gagal menyetujui pengajuan'),
        backgroundColor: AppColors.primary,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildFilterChips(),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: _filteredLeaves.isEmpty
                      ? const EmptyState(
                          icon: Icons.history_rounded,
                          title: 'Tidak ada riwayat pengajuan',
                          subtitle: 'Belum ada data pengajuan izin/cuti.',
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                          itemCount: _filteredLeaves.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (_, i) {
                            final l = _filteredLeaves[i];
                            final start = DateTime.parse(l['start_date'] as String);
                            final end = DateTime.parse(l['end_date'] as String);
                            final isPending = l['status'] == 'pending';
                            final hasReviewNotes = l['review_notes'] != null && (l['review_notes'] as String).isNotEmpty;

                            return AppCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 40,
                                        height: 40,
                                        decoration: BoxDecoration(
                                          gradient: AppColors.primaryGradient,
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Center(
                                          child: Text(
                                            ((l['user_name'] as String? ?? '?')[0]).toUpperCase(),
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 18,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              l['user_name'] ?? '-',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 14,
                                                color: AppColors.textPrimary,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              [l['department'], l['position'], l['employee_id']]
                                                  .where((v) => v != null && v.toString().isNotEmpty)
                                                  .join('  -  '),
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColors.textMuted,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      StatusBadge(status: l['status'] ?? 'pending'),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: AppColors.grey50,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Column(
                                      children: [
                                        Row(
                                          children: [
                                            const Icon(Icons.category_outlined, size: 14, color: AppColors.textMuted),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                l['type'] == 'annual'
                                                    ? 'Cuti Tahunan'
                                                    : l['type'] == 'sick'
                                                        ? 'Izin Sakit'
                                                        : l['type'] == 'wfh'
                                                            ? 'WFH'
                                                            : l['type'] == 'dinas'
                                                                ? 'Dinas Luar'
                                                                : l['type'] ?? '-',
                                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textMuted),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                '${DateFormat('d MMM yyyy', 'id_ID').format(start)}  -  ${DateFormat('d MMM yyyy', 'id_ID').format(end)}',
                                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            const Icon(Icons.access_time_rounded, size: 14, color: AppColors.textMuted),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                '${l['total_days']} hari kerja',
                                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Icon(Icons.notes_rounded, size: 14, color: AppColors.textMuted),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                l['reason'] ?? '-',
                                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (!isPending && (l['reviewer_name'] != null || hasReviewNotes)) ...[
                                    const SizedBox(height: 8),
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: AppColors.border),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (l['reviewer_name'] != null)
                                            Text(
                                              'Ditinjau oleh: ${l['reviewer_name']}',
                                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                            ),
                                          if (hasReviewNotes) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              'Catatan: "${l['review_notes']}"',
                                              style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textMuted),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ],
                                  if (isPending) ...[
                                    const SizedBox(height: 12),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton.icon(
                                            onPressed: () => _openReview(l),
                                            icon: const Icon(Icons.close_rounded, size: 16),
                                            label: const Text('Tolak'),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: AppColors.danger,
                                              side: const BorderSide(color: AppColors.danger),
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
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      {'value': 'all', 'label': 'Semua'},
      {'value': 'pending', 'label': 'Menunggu'},
      {'value': 'approved', 'label': 'Disetujui'},
      {'value': 'rejected', 'label': 'Ditolak'},
    ];

    return Container(
      height: 48,
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final f = filters[index];
          final isSelected = _statusFilter == f['value'];
          return ChoiceChip(
            label: Text(f['label']!),
            selected: isSelected,
            onSelected: (val) {
              if (val) {
                HapticFeedback.selectionClick();
                setState(() => _statusFilter = f['value']!);
              }
            },
            selectedColor: AppColors.primary,
            labelStyle: TextStyle(
              color: isSelected ? Colors.white : AppColors.textSecondary,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              fontSize: 12,
            ),
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(color: isSelected ? Colors.transparent : AppColors.border),
            ),
            showCheckmark: false,
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-TAB: RIWAYAT LEMBUR
// ─────────────────────────────────────────────────────────────────────────────
class _OvertimeHistorySubTab extends StatefulWidget {
  const _OvertimeHistorySubTab();

  @override
  State<_OvertimeHistorySubTab> createState() => _OvertimeHistorySubTabState();
}

class _OvertimeHistorySubTabState extends State<_OvertimeHistorySubTab> {
  List<OvertimeModel> _overtimes = [];
  bool _loading = true;
  String _statusFilter = 'all'; // all, pending, approved, rejected
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _load();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'overtime_update') {
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
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final data = await ApiService().getAllOvertime();
      if (mounted) {
        setState(() {
          _overtimes = (data['overtimes'] as List? ?? [])
              .map((o) => OvertimeModel.fromJson(Map<String, dynamic>.from(o)))
              .toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<OvertimeModel> get _filteredOvertimes {
    if (_statusFilter == 'all') return _overtimes;
    return _overtimes.where((o) => o.status == _statusFilter).toList();
  }

  void _openReview(OvertimeModel overtime) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _OvertimeReviewSheet(
        overtime: overtime,
        onDone: _load,
      ),
    );
  }

  Future<void> _quickApprove(OvertimeModel overtime) async {
    HapticFeedback.lightImpact();
    final data = await ApiService().reviewOvertime(overtime.id, 'approved');
    if (!mounted) return;
    if (data['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Lembur disetujui ✅'),
        backgroundColor: AppColors.teal,
      ));
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data['message'] ?? 'Gagal menyetujui lembur'),
        backgroundColor: AppColors.primary,
      ));
    }
  }

  void _viewFullAttachment(String url) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            InteractiveViewer(
              minScale: 0.5,
              maxScale: 4.0,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  loadingBuilder: (_, child, progress) {
                    if (progress == null) return child;
                    return const Center(child: CircularProgressIndicator(color: Colors.white));
                  },
                  errorBuilder: (_, __, ___) => Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(32),
                    child: const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.broken_image_rounded, size: 48, color: AppColors.danger),
                        SizedBox(height: 12),
                        Text('Gagal memuat gambar bukti', style: TextStyle(color: AppColors.textPrimary)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
              style: IconButton.styleFrom(
                backgroundColor: Colors.black45,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildFilterChips(),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: _filteredOvertimes.isEmpty
                      ? const EmptyState(
                          icon: Icons.history_rounded,
                          title: 'Tidak ada riwayat pengajuan',
                          subtitle: 'Belum ada data pengajuan lembur.',
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                          itemCount: _filteredOvertimes.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (_, i) {
                            final ot = _filteredOvertimes[i];
                            final date = DateTime.parse(ot.date);
                            final isPending = ot.status == 'pending';
                            final hasReviewNotes = ot.reviewNotes != null && ot.reviewNotes!.isNotEmpty;
                            final attachmentUrl = ot.attachment != null && ot.attachment!.isNotEmpty
                                ? '${AppConstants.uploadsUrl}/overtime/${ot.attachment}'
                                : null;

                            return AppCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      UserAvatar(
                                        name: ot.userName ?? '?',
                                        size: 40,
                                        avatarFilename: ot.userAvatar,
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              ot.userName ?? '-',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 14,
                                                color: AppColors.textPrimary,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              [ot.department, ot.position, ot.employeeId]
                                                  .where((v) => v != null && v.toString().isNotEmpty)
                                                  .join('  -  '),
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColors.textMuted,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      StatusBadge(status: ot.status),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: AppColors.grey50,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Column(
                                      children: [
                                        Row(
                                          children: [
                                            const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textMuted),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(date),
                                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            const Icon(Icons.access_time_rounded, size: 14, color: AppColors.textMuted),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                '${ot.startTime}  -  ${ot.endTime}  (${ot.durationLabel})',
                                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Icon(Icons.notes_rounded, size: 14, color: AppColors.textMuted),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                ot.reason,
                                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                                              ),
                                            ),
                                          ],
                                        ),
                                        if (attachmentUrl != null) ...[
                                          const SizedBox(height: 12),
                                          Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Icon(Icons.image_outlined, size: 14, color: AppColors.textMuted),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    const Text('Foto Bukti:', style: TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
                                                    const SizedBox(height: 6),
                                                    GestureDetector(
                                                      onTap: () => _viewFullAttachment(attachmentUrl),
                                                      child: Container(
                                                        height: 120,
                                                        width: 160,
                                                        decoration: BoxDecoration(
                                                          borderRadius: BorderRadius.circular(8),
                                                          border: Border.all(color: AppColors.border),
                                                        ),
                                                        clipBehavior: Clip.antiAlias,
                                                        child: Image.network(
                                                          attachmentUrl,
                                                          fit: BoxFit.cover,
                                                          errorBuilder: (_, __, ___) => const Center(
                                                            child: Icon(Icons.broken_image_rounded, color: AppColors.textMuted),
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  if (!isPending && (ot.reviewerName != null || hasReviewNotes)) ...[
                                    const SizedBox(height: 8),
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: AppColors.border),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (ot.reviewerName != null)
                                            Text(
                                              'Ditinjau oleh: ${ot.reviewerName}',
                                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                            ),
                                          if (hasReviewNotes) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              'Catatan: "${ot.reviewNotes}"',
                                              style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textMuted),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ],
                                  if (isPending) ...[
                                    const SizedBox(height: 12),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton.icon(
                                            onPressed: () => _openReview(ot),
                                            icon: const Icon(Icons.close_rounded, size: 16),
                                            label: const Text('Tolak'),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: AppColors.danger,
                                              side: const BorderSide(color: AppColors.danger),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: ElevatedButton.icon(
                                            onPressed: () => _quickApprove(ot),
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
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            );
                          },
                        ),
                ),
        ),
      ],
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      {'value': 'all', 'label': 'Semua'},
      {'value': 'pending', 'label': 'Menunggu'},
      {'value': 'approved', 'label': 'Disetujui'},
      {'value': 'rejected', 'label': 'Ditolak'},
    ];

    return Container(
      height: 48,
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final f = filters[index];
          final isSelected = _statusFilter == f['value'];
          return ChoiceChip(
            label: Text(f['label']!),
            selected: isSelected,
            onSelected: (val) {
              if (val) {
                HapticFeedback.selectionClick();
                setState(() => _statusFilter = f['value']!);
              }
            },
            selectedColor: AppColors.primary,
            labelStyle: TextStyle(
              color: isSelected ? Colors.white : AppColors.textSecondary,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              fontSize: 12,
            ),
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(color: isSelected ? Colors.transparent : AppColors.border),
            ),
            showCheckmark: false,
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET: REVIEW CUTI
// ─────────────────────────────────────────────────────────────────────────────
class _LeaveReviewSheet extends StatefulWidget {
  final Map<String, dynamic> leave;
  final VoidCallback onDone;

  const _LeaveReviewSheet({required this.leave, required this.onDone});

  @override
  State<_LeaveReviewSheet> createState() => _LeaveReviewSheetState();
}

class _LeaveReviewSheetState extends State<_LeaveReviewSheet> {
  final _notesCtrl = TextEditingController();
  bool _loading = false;
  String _action = 'rejected';

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_action == 'rejected' && _notesCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Catatan alasan wajib diisi saat menolak ⚠️'),
        backgroundColor: AppColors.danger,
      ));
      return;
    }
    setState(() => _loading = true);
    final data = await ApiService().reviewLeave(
      widget.leave['id'] as String,
      _action,
      notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
    );
    if (!mounted) return;
    setState(() => _loading = false);
    if (data['success'] == true) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(_action == 'approved' ? 'Pengajuan disetujui ✅' : 'Pengajuan ditolak ❌'),
        backgroundColor: _action == 'approved' ? AppColors.teal : AppColors.danger,
      ));
      widget.onDone();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data['message'] ?? 'Gagal'),
        backgroundColor: AppColors.primary,
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          const Text(
            'Review Pengajuan Izin/Cuti',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 4),
          Text(l['user_name'] ?? '-', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _action = 'approved'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _action == 'approved' ? AppColors.teal : AppColors.grey100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_rounded, color: _action == 'approved' ? Colors.white : AppColors.textMuted, size: 18),
                        const SizedBox(width: 6),
                        Text(
                          'Setujui',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: _action == 'approved' ? Colors.white : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _action = 'rejected'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _action == 'rejected' ? AppColors.danger : AppColors.grey100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.close_rounded, color: _action == 'rejected' ? Colors.white : AppColors.textMuted, size: 18),
                        const SizedBox(width: 6),
                        Text(
                          'Tolak',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: _action == 'rejected' ? Colors.white : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _notesCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: _action == 'rejected' ? 'Alasan penolakan (wajib)...' : 'Catatan tambahan (opsional)...',
              filled: true,
              fillColor: AppColors.grey100,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: _action == 'approved' ? AppColors.teal : AppColors.danger,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      _action == 'approved' ? 'Setujui Pengajuan' : 'Tolak Pengajuan',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET: REVIEW LEMBUR
// ─────────────────────────────────────────────────────────────────────────────
class _OvertimeReviewSheet extends StatefulWidget {
  final OvertimeModel overtime;
  final VoidCallback onDone;

  const _OvertimeReviewSheet({required this.overtime, required this.onDone});

  @override
  State<_OvertimeReviewSheet> createState() => _OvertimeReviewSheetState();
}

class _OvertimeReviewSheetState extends State<_OvertimeReviewSheet> {
  final _notesCtrl = TextEditingController();
  bool _loading = false;
  String _action = 'rejected';

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_action == 'rejected' && _notesCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Catatan alasan wajib diisi saat menolak ⚠️'),
        backgroundColor: AppColors.danger,
      ));
      return;
    }
    setState(() => _loading = true);
    final data = await ApiService().reviewOvertime(
      widget.overtime.id,
      _action,
      notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
    );
    if (!mounted) return;
    setState(() => _loading = false);
    if (data['success'] == true) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(_action == 'approved' ? 'Lembur disetujui ✅' : 'Lembur ditolak ❌'),
        backgroundColor: _action == 'approved' ? AppColors.teal : AppColors.danger,
      ));
      widget.onDone();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data['message'] ?? 'Gagal'),
        backgroundColor: AppColors.primary,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 16),
          const Text(
            'Review Pengajuan Lembur',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 4),
          Text(widget.overtime.userName ?? '-', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _action = 'approved'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _action == 'approved' ? AppColors.teal : AppColors.grey100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_rounded, color: _action == 'approved' ? Colors.white : AppColors.textMuted, size: 18),
                        const SizedBox(width: 6),
                        Text(
                          'Setujui',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: _action == 'approved' ? Colors.white : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _action = 'rejected'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: _action == 'rejected' ? AppColors.danger : AppColors.grey100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.close_rounded, color: _action == 'rejected' ? Colors.white : AppColors.textMuted, size: 18),
                        const SizedBox(width: 6),
                        Text(
                          'Tolak',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: _action == 'rejected' ? Colors.white : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _notesCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: _action == 'rejected' ? 'Alasan penolakan (wajib)...' : 'Catatan tambahan (opsional)...',
              filled: true,
              fillColor: AppColors.grey100,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: _action == 'approved' ? AppColors.teal : AppColors.danger,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      _action == 'approved' ? 'Setujui Pengajuan' : 'Tolak Pengajuan',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
