import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../services/realtime_service.dart';

class TeamCalendarScreen extends StatefulWidget {
  final bool showAppBar;
  const TeamCalendarScreen({super.key, this.showAppBar = true});

  @override
  State<TeamCalendarScreen> createState() => _TeamCalendarScreenState();
}

class _TeamCalendarScreenState extends State<TeamCalendarScreen> {
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
      if (mounted) {
        setState(() {
          _onLeave = data['onLeave'] as List? ?? [];
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final Widget mainBody = _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : RefreshIndicator(
            onRefresh: _load,
            color: AppColors.primary,
            child: _onLeave.isEmpty
                ? const EmptyState(
                    icon: Icons.event_available_outlined,
                    title: 'Tidak ada izin atau cuti',
                    subtitle: 'Tidak ada karyawan yang sedang izin atau cuti minggu ini.',
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    itemCount: _onLeave.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final l = _onLeave[i] as Map<String, dynamic>;
                      final start = DateTime.parse(l['start_date'] as String);
                      final end = DateTime.parse(l['end_date'] as String);
                      return AppCard(
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                gradient: AppColors.primaryGradient,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Text(
                                  ((l['name'] as String? ?? '?')[0]).toUpperCase(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 18,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    l['name'] ?? '-',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    [l['department'], l['position']]
                                        .where((v) => v != null && v.toString().isNotEmpty)
                                        .join('  -  '),
                                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${DateFormat('d MMM', 'id_ID').format(start)}  -  ${DateFormat('d MMM', 'id_ID').format(end)}  (${l['total_days']} hari)',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textSecondary,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.primaryBg,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.primaryBorder),
                              ),
                              child: Text(
                                l['type_label'] ?? l['type'] ?? '-',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
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
                  title: 'Kalender Tim',
                  showBackButton: true,
                ),
                Expanded(child: mainBody),
              ],
            )
          : NestedScrollView(
              headerSliverBuilder: (context, innerBoxIsScrolled) => [
                SliverToBoxAdapter(
                  child: ProfileHeader(
                    title: 'Kalender Tim',
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
}
