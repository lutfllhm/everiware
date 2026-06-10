import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../services/realtime_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/animations.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  int _unread = 0;
  bool _loading = true;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _load();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'notification_update') {
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
    if (mounted) setState(() => _loading = true);
    try {
      final data = await ApiService().getNotifications();
      if (mounted) {
        setState(() {
          _notifications = List<Map<String, dynamic>>.from(data['notifications'] ?? []);
          _unread = data['unread'] ?? 0;
          _loading = false;
        });
      }
      Future.delayed(const Duration(milliseconds: 1500), () {
        ApiService().markNotificationsRead();
        if (mounted) setState(() => _unread = 0);
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    HapticFeedback.lightImpact();
    await ApiService().markNotificationsRead();
    if (!mounted) return;
    setState(() {
      _notifications = _notifications.map((n) => {...n, 'is_read': 1}).toList();
      _unread = 0;
    });
    _snack('Semua notifikasi sudah dibaca');
  }

  Future<void> _deleteOne(String id) async {
    HapticFeedback.lightImpact();
    await ApiService().deleteNotification(id);
    if (!mounted) return;
    setState(() => _notifications.removeWhere((n) => n['id'] == id));
    _snack('Notifikasi dihapus');
  }

  Future<void> _deleteAll({bool onlyRead = false}) async {
    HapticFeedback.mediumImpact();
    Navigator.pop(context);
    await ApiService().deleteAllNotifications(onlyRead: onlyRead);
    if (!mounted) return;
    if (onlyRead) {
      setState(() => _notifications.removeWhere((n) => n['is_read'] == 1 || n['is_read'] == true));
      _snack('Notifikasi yang sudah dibaca dihapus');
    } else {
      setState(() { _notifications.clear(); _unread = 0; });
      _snack('Semua notifikasi dihapus');
    }
  }

  void _showDeleteMenu() {
    HapticFeedback.lightImpact();
    final readCount = _notifications.where((n) => n['is_read'] == 1 || n['is_read'] == true).length;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.grey200, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text('Hapus Notifikasi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.textPrimary)),
          const SizedBox(height: 4),
          const Text('Pilih notifikasi yang ingin dihapus', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
          const SizedBox(height: 20),
          if (readCount > 0) ...[
            _DeleteOption(
              icon: Icons.done_all_rounded,
              color: AppColors.teal,
              title: 'Hapus yang sudah dibaca',
              subtitle: '$readCount notifikasi',
              onTap: () => _deleteAll(onlyRead: true),
            ),
            const SizedBox(height: 10),
          ],
          _DeleteOption(
            icon: Icons.delete_sweep_rounded,
            color: AppColors.danger,
            title: 'Hapus semua notifikasi',
            subtitle: '${_notifications.length} notifikasi',
            onTap: () => _deleteAll(onlyRead: false),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal', style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ),
    );
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(fontWeight: FontWeight.w500)),
      backgroundColor: AppColors.grey900,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  String _timeAgo(String? createdAt) {
    if (createdAt == null) return '';
    try {
      final dt = DateTime.parse(createdAt).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Baru saja';
      if (diff.inHours < 1) return '${diff.inMinutes} menit lalu';
      if (diff.inDays < 1) return '${diff.inHours} jam lalu';
      if (diff.inDays < 7) return '${diff.inDays} hari lalu';
      return DateFormat('d MMM yyyy', 'id_ID').format(dt);
    } catch (_) {
      return '';
    }
  }

  Map<String, dynamic> _typeConfig(String type) {
    switch (type) {
      case 'success':
        return {'icon': Icons.check_circle_outline_rounded, 'color': AppColors.teal, 'bg': AppColors.teal50};
      case 'warning':
        return {'icon': Icons.warning_amber_rounded, 'color': AppColors.warning, 'bg': AppColors.warningBg};
      case 'error':
        return {'icon': Icons.cancel_outlined, 'color': AppColors.danger, 'bg': AppColors.dangerBg};
      default:
        return {'icon': Icons.info_outline_rounded, 'color': AppColors.primary, 'bg': AppColors.primaryBg};
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: RefreshIndicator(
          onRefresh: _load,
          color: const Color(0xFF8B1F1F),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _buildHeroHeader(),
              ),
              if (_loading)
                SliverToBoxAdapter(
                  child: _buildShimmer(),
                )
              else if (_notifications.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: EmptyState(
                      icon: Icons.notifications_none_rounded,
                      title: 'Belum ada notifikasi',
                      subtitle: 'Notifikasi dari HRD akan muncul di sini',
                      actionLabel: 'Refresh',
                      onAction: _load,
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate(
                      _buildGroupedNotifications(),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroHeader() {
    return ProfileHeader(
      title: 'Pemberitahuan HRD',
      showBackButton: true,
      rightWidget: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_unread > 0)
            IconButton(
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(),
              icon: const Icon(Icons.done_all_rounded, size: 20, color: Colors.white),
              onPressed: _markAllRead,
              tooltip: 'Tandai semua dibaca',
            ),
          if (_notifications.isNotEmpty) ...[
            const SizedBox(width: 8),
            IconButton(
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(),
              icon: const Icon(Icons.delete_sweep_rounded, size: 20, color: Colors.white),
              onPressed: _showDeleteMenu,
              tooltip: 'Hapus notifikasi',
            ),
          ],
          const SizedBox(width: 8),
          IconButton(
            padding: const EdgeInsets.all(4),
            constraints: const BoxConstraints(),
            icon: _loading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.refresh_rounded, size: 20, color: Colors.white),
            onPressed: _load,
            tooltip: 'Segarkan',
          ),
        ],
      ),
      customCenterWidget: Container(
        width: 100,
        height: 100,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Center(
          child: Container(
            width: 84,
            height: 84,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [Color(0xFF8B1F1F), Color(0xFFDC2626)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: const Center(
              child: Icon(
                Icons.notifications_active_rounded,
                color: Colors.white,
                size: 40,
              ),
            ),
          ),
        ),
      ),
      customSubtitle: _unread > 0 ? '$_unread belum dibaca' : 'Tidak ada notifikasi baru',
    );
  }

  List<Widget> _buildGroupedNotifications() {
    final Map<String, List<Map<String, dynamic>>> grouped = {};
    for (final notif in _notifications) {
      final createdAt = notif['created_at'] as String?;
      String groupKey = 'Lainnya';
      if (createdAt != null) {
        try {
          final dt = DateTime.parse(createdAt).toLocal();
          final diff = DateTime.now().difference(dt).inDays;
          if (diff == 0) {
            groupKey = 'Hari Ini';
          } else if (diff == 1) {
            groupKey = 'Kemarin';
          } else if (diff < 7) {
            groupKey = 'Minggu Ini';
          } else {
            groupKey = DateFormat('MMMM yyyy', 'id_ID').format(dt);
          }
        } catch (_) {}
      }
      grouped.putIfAbsent(groupKey, () => []).add(notif);
    }

    final widgets = <Widget>[];
    int idx = 0;
    for (final entry in grouped.entries) {
      widgets.add(Padding(
        padding: const EdgeInsets.only(bottom: 10, top: 4),
        child: Text(entry.key, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
      ));
      for (final notif in entry.value) {
        final i = idx;
        widgets.add(FadeSlideIn(
          delay: Duration(milliseconds: 40 * i),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Dismissible(
              key: Key(notif['id'] as String),
              direction: DismissDirection.endToStart,
              background: Container(
                alignment: Alignment.centerRight,
                padding: const EdgeInsets.only(right: 20),
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.danger.withValues(alpha: 0.30)),
                ),
                child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.delete_rounded, color: AppColors.danger, size: 20),
                  SizedBox(height: 3),
                  Text('Hapus', style: TextStyle(color: AppColors.danger, fontSize: 10, fontWeight: FontWeight.w600)),
                ]),
              ),
              confirmDismiss: (_) async { await _deleteOne(notif['id'] as String); return false; },
              child: _buildItem(notif),
            ),
          ),
        ));
        idx++;
      }
    }
    return widgets;
  }

  Widget _buildShimmer() => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(
      children: List.generate(6, (i) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(children: [
            const ShimmerBox(width: 40, height: 40, radius: 10),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ShimmerBox(width: MediaQuery.of(context).size.width * 0.45, height: 13, radius: 6),
              const SizedBox(height: 7),
              ShimmerBox(width: MediaQuery.of(context).size.width * 0.65, height: 11, radius: 5),
              const SizedBox(height: 5),
              const ShimmerBox(width: 70, height: 9, radius: 4),
            ])),
          ]),
        ),
      )),
    ),
  );

  Widget _buildItem(Map<String, dynamic> notif) {
    final isRead = notif['is_read'] == 1 || notif['is_read'] == true;
    final type = notif['type'] ?? 'info';
    final cfg = _typeConfig(type);
    final timeAgo = _timeAgo(notif['created_at']);
    final title = (notif['title'] ?? '') as String;

    String? navRoute;
    if (title.contains('Lembur')) {
      navRoute = 'overtime';
    } else if (title.contains('Izin') || title.contains('Cuti')) {
      navRoute = 'leave';
    } else if (title.contains('Absen')) {
      navRoute = 'attendance';
    }

    return Container(
      decoration: BoxDecoration(
        color: isRead ? Colors.white : (cfg['bg'] as Color),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isRead ? AppColors.border : (cfg['color'] as Color).withValues(alpha: 0.20),
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: navRoute == null ? null : () {
            if (!isRead) {
              ApiService().markNotificationsRead();
              setState(() {
                final idx = _notifications.indexWhere((n) => n['id'] == notif['id']);
                if (idx != -1) _notifications[idx] = {..._notifications[idx], 'is_read': 1};
              });
            }
            Navigator.pop(context, navRoute);
          },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: isRead ? AppColors.grey100 : (cfg['color'] as Color).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(cfg['icon'] as IconData, size: 20, color: isRead ? AppColors.textMuted : (cfg['color'] as Color)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(
                      child: Text(title, style: TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13,
                        color: isRead ? AppColors.textSecondary : AppColors.textPrimary,
                      )),
                    ),
                    if (!isRead)
                      Container(width: 7, height: 7, decoration: BoxDecoration(color: cfg['color'] as Color, shape: BoxShape.circle)),
                  ]),
                  const SizedBox(height: 3),
                  Text(notif['message'] ?? '', style: TextStyle(color: isRead ? AppColors.textMuted : AppColors.textSecondary, fontSize: 12, height: 1.4)),
                  const SizedBox(height: 6),
                  Row(children: [
                    const Icon(Icons.access_time_rounded, size: 10, color: AppColors.textMuted),
                    const SizedBox(width: 3),
                    Text(timeAgo, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                    if (navRoute != null) ...[
                      const Spacer(),
                      Text('Lihat →', style: TextStyle(fontSize: 11, color: cfg['color'] as Color, fontWeight: FontWeight.w600)),
                    ],
                  ]),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _DeleteOption extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title, subtitle;
  final VoidCallback onTap;

  const _DeleteOption({required this.icon, required this.color, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Row(children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: color)),
          Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
        ])),
        Icon(Icons.chevron_right_rounded, color: color.withValues(alpha: 0.5), size: 18),
      ]),
    ),
  );
}
