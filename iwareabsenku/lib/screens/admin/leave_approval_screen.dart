import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../services/realtime_service.dart';

class LeaveApprovalScreen extends StatefulWidget {
  final bool showAppBar;
  const LeaveApprovalScreen({super.key, this.showAppBar = true});

  @override
  State<LeaveApprovalScreen> createState() => _LeaveApprovalScreenState();
}

class _LeaveApprovalScreenState extends State<LeaveApprovalScreen> {
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

  void _openReview(Map<String, dynamic> leave) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReviewSheet(
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
    final Widget mainBody = _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : RefreshIndicator(
            onRefresh: _load,
            color: AppColors.primary,
              child: _leaves.isEmpty
                  ? const EmptyState(
                      icon: Icons.check_circle_outline_rounded,
                      title: 'Tidak ada pengajuan pending',
                      subtitle: 'Semua pengajuan cuti dan izin sudah diproses.',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      itemCount: _leaves.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (_, i) {
                        final l = _leaves[i];
                        final start = DateTime.parse(l['start_date'] as String);
                        final end = DateTime.parse(l['end_date'] as String);
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
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.amber100,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
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
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.warning,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
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
                                            l['reason'] ?? '-',
                                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
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
                          ),
                        );
                      },
                    ),
            );

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: widget.showAppBar
          ? Column(
              children: [
                const ProfileHeader(
                  title: 'Riwayat Izin & Cuti',
                  showBackButton: true,
                ),
                Expanded(child: mainBody),
              ],
            )
          : mainBody,
    );
  }
}

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
