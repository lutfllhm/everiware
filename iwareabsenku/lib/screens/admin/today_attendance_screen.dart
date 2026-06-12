import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../services/realtime_service.dart';

class TodayAttendanceScreen extends StatefulWidget {
  final bool showAppBar;
  const TodayAttendanceScreen({super.key, this.showAppBar = true});

  @override
  State<TodayAttendanceScreen> createState() => _TodayAttendanceScreenState();
}

class _TodayAttendanceScreenState extends State<TodayAttendanceScreen> {
  List<Map<String, dynamic>> _all = [];
  bool _loading = true;
  String _filter = 'all';
  String _searchQuery = '';
  final _searchCtrl = TextEditingController();
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
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getTodayAllAttendance();
      if (mounted) {
        setState(() {
          final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
          _all = (data['attendances'] as List? ?? [])
              .map((a) => Map<String, dynamic>.from(a))
              .where((a) => a['date'] == today)
              .toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    List<Map<String, dynamic>> list = _all;

    // Filter by status
    if (_filter != 'all') {
      list = list.where((a) => a['status'] == _filter).toList();
    }

    // Filter by search query
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      list = list.where((a) {
        final name = (a['user_name'] as String? ?? '').toLowerCase();
        final dept = (a['department'] as String? ?? '').toLowerCase();
        return name.contains(q) || dept.contains(q);
      }).toList();
    }

    return list;
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final present = _all.where((a) => a['status'] == 'present').length;
    final late = _all.where((a) => a['status'] == 'late').length;
    final absent = _all.where((a) => a['status'] == 'absent').length;

    final Widget mainBody = _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : Column(
            children: [
              // Top Search and Filter panel
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                child: Column(
                  children: [
                    // Search box
                    TextField(
                      controller: _searchCtrl,
                      onChanged: (val) => setState(() => _searchQuery = val),
                      decoration: InputDecoration(
                        hintText: 'Cari karyawan atau departemen...',
                        prefixIcon: const Icon(Icons.search_rounded, size: 20),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                onPressed: () {
                                  _searchCtrl.clear();
                                  setState(() => _searchQuery = '');
                                },
                                icon: const Icon(Icons.close_rounded, size: 18),
                              )
                            : null,
                        filled: true,
                        fillColor: AppColors.grey50,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.border),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Summary chips row
                    Row(
                      children: [
                        _buildSummaryChip('Hadir', present, 'present', AppColors.teal),
                        const SizedBox(width: 8),
                        _buildSummaryChip('Terlambat', late, 'late', AppColors.amber),
                        const SizedBox(width: 8),
                        _buildSummaryChip('Absen', absent, 'absent', AppColors.danger),
                      ],
                    ),
                  ],
                ),
              ),
              // Attendance list
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: _filtered.isEmpty
                      ? const EmptyState(
                          icon: Icons.event_busy_outlined,
                          title: 'Tidak ada data kehadiran',
                          subtitle: 'Tidak ditemukan data absensi untuk pencarian ini.',
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) {
                            final att = _filtered[i];
                            final checkIn = att['check_in'] != null
                                ? DateFormat('HH:mm').format(DateTime.parse(att['check_in'] as String))
                                : '--:--';
                            final checkOut = att['check_out'] != null
                                ? DateFormat('HH:mm').format(DateTime.parse(att['check_out'] as String))
                                : '--:--';

                            return AppCard(
                              child: Row(
                                children: [
                                  UserAvatar(
                                    name: att['user_name'] ?? '?',
                                    size: 42,
                                    avatarFilename: att['user_avatar'],
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          att['user_name'] ?? '-',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 14,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          [att['department'], att['position']]
                                              .where((v) => v != null && v.toString().isNotEmpty)
                                              .join('  -  '),
                                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            const Icon(Icons.login_rounded, size: 12, color: AppColors.teal),
                                            const SizedBox(width: 4),
                                            Text(checkIn, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                            const SizedBox(width: 12),
                                            const Icon(Icons.logout_rounded, size: 12, color: AppColors.danger),
                                            const SizedBox(width: 4),
                                            Text(checkOut, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  StatusBadge(status: att['status'] ?? 'present'),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ),
            ],
          );

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: widget.showAppBar
          ? Column(
              children: [
                const ProfileHeader(
                  title: 'Kehadiran Hari Ini',
                  showBackButton: true,
                ),
                Expanded(child: mainBody),
              ],
            )
          : NestedScrollView(
              headerSliverBuilder: (context, innerBoxIsScrolled) => [
                SliverToBoxAdapter(
                  child: ProfileHeader(
                    title: 'Kehadiran Hari Ini',
                    name: user?.name,
                    position: user?.position ?? user?.roleLabel,
                    department: user?.department ?? user?.deptPosition,
                    avatarFilename: user?.avatar,
                  ),
                ),
              ],
              body: mainBody,
            ),
    );
  }

  Widget _buildSummaryChip(String label, int count, String statusVal, Color color) {
    final active = _filter == statusVal;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _filter = active ? 'all' : statusVal),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: active ? color : color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: active ? color : color.withValues(alpha: 0.15)),
          ),
          child: Column(
            children: [
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: active ? Colors.white : color,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                label,
                style: TextStyle(
                  fontSize: 9,
                  color: active ? Colors.white70 : color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
