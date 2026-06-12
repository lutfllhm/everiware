import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../../services/api_service.dart';
import '../../services/offline_queue.dart';
import '../../utils/app_theme.dart';
import 'attendance_screen.dart';
import 'calendar_screen.dart';
import 'history_screen.dart';
import 'profile_screen.dart';
import 'notifications_screen.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../services/fcm_service.dart';
import '../../services/realtime_service.dart';
import 'dashboard_tab.dart';
import '../../widgets/animations.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _currentIndex = 0;
  int _unreadNotif = 0;
  int _offlinePending = 0;
  bool _isBottomNavVisible = true;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    
    // Redirect to onboarding if employee face is not registered yet
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final auth = context.read<AuthProvider>();
        if (!auth.isAdmin && auth.user?.faceRegistered != true) {
          Navigator.pushReplacementNamed(context, '/intro');
        }
      }
    });

    _fetchUnread();
    _checkOfflineQueue();

    _realtimeSub = RealtimeService().events.listen((event) {
      final evName = event['event'];
      if (evName == 'notification_update') {
        _fetchUnread();
      }
    });

    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 15));
      if (!mounted) return false;
      _fetchUnread();
      return true;
    });

    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final isOnline = results.any((r) => r != ConnectivityResult.none);
      if (isOnline && mounted) _syncOfflineQueue();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connectivitySub?.cancel();
    _realtimeSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final auth = context.read<AuthProvider>();
      if (auth.isAuthenticated && auth.token != null) {
        debugPrint('📱 App resumed, force reconnecting SSE...');
        RealtimeService().disconnect();
        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted && auth.isAuthenticated && auth.token != null) {
            RealtimeService().connect(auth.token!);
            _fetchUnread();
          }
        });
      }
    }
  }

  Future<void> _checkOfflineQueue() async {
    final count = await OfflineQueue().pendingCount();
    if (mounted) setState(() => _offlinePending = count);
  }

  Future<void> _syncOfflineQueue() async {
    final count = await OfflineQueue().pendingCount();
    if (count == 0) return;
    final synced = await OfflineQueue().syncAll();
    if (synced > 0 && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Row(children: [
          const Icon(Icons.cloud_done_rounded, color: Colors.white, size: 16),
          const SizedBox(width: 8),
          Text('$synced absensi offline berhasil disinkronkan',
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
        ]),
        backgroundColor: AppColors.teal,
        duration: const Duration(seconds: 3),
      ));
      _checkOfflineQueue();
    }
  }

  int _prevUnread = 0;

  Future<void> _fetchUnread() async {
    try {
      final data = await ApiService().getNotifications();
      final newUnread = data['unread'] ?? 0;
      if (newUnread > _prevUnread && _prevUnread != 0 && mounted) {
        final diff = newUnread - _prevUnread;
        FcmService().showNotification(
          diff == 1 ? '1 notifikasi baru' : '$diff notifikasi baru',
          'Tap untuk melihat notifikasi dari HRD',
          payload: 'notifications',
        );
        if (_currentIndex != 3) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Row(children: [
              const Icon(Icons.notifications_rounded, color: Colors.white, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  diff == 1 ? '1 notifikasi baru dari HRD' : '$diff notifikasi baru dari HRD',
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                ),
              ),
            ]),
            backgroundColor: AppColors.grey900,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Lihat',
              textColor: Colors.white70,
              onPressed: () => _openNotifications(),
            ),
          ));
        }
      }
      _prevUnread = newUnread;
      if (mounted) setState(() => _unreadNotif = newUnread);
    } catch (_) {}
  }

  void _goToTab(int i) {
    if (_currentIndex == i) return;
    HapticFeedback.selectionClick();
    setState(() {
      _currentIndex = i;
      _isBottomNavVisible = true;
    });
  }

  void _openNotifications() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
    ).then((route) {
      _fetchUnread();
      if (route == 'leave') {
        _goToTab(1);
      } else if (route == 'overtime') {
        _goToTab(3);
      } else if (route == 'attendance') {
        _goToTab(2);
      }
    });
  }

  DateTime? _lastBackPress;

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardTab(
          onNavigate: _goToTab,
          onNotifTap: _openNotifications,
          unreadNotif: _unreadNotif,
          offlinePending: _offlinePending,
          onSyncTap: _syncOfflineQueue),
      const HistoryScreen(),
      const AttendanceScreen(),
      const CalendarScreen(),
      const ProfileScreen(),
    ];
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (_currentIndex != 0) {
          _goToTab(0);
          return;
        }
        final now = DateTime.now();
        final isDoubleBack = _lastBackPress != null &&
            now.difference(_lastBackPress!) < const Duration(seconds: 2);
        if (isDoubleBack) {
          SystemNavigator.pop();
        } else {
          _lastBackPress = now;
          ScaffoldMessenger.of(context).clearSnackBars();
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Row(children: [
              Icon(Icons.exit_to_app_rounded, color: Colors.white, size: 16),
              SizedBox(width: 8),
              Text('Tekan sekali lagi untuk keluar',
                  style: TextStyle(fontWeight: FontWeight.w500)),
            ]),
            duration: Duration(seconds: 2),
          ));
        }
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Scaffold(
          backgroundColor: AppColors.surface,
          extendBody: true,
          body: NotificationListener<UserScrollNotification>(
            onNotification: (notification) {
              if (notification.direction == ScrollDirection.reverse) {
                if (_isBottomNavVisible) {
                  setState(() {
                    _isBottomNavVisible = false;
                  });
                }
              } else if (notification.direction == ScrollDirection.forward) {
                if (!_isBottomNavVisible) {
                  setState(() {
                    _isBottomNavVisible = true;
                  });
                }
              }
              return false;
            },
            child: AnimatedIndexedStack(
              index: _currentIndex,
              children: pages,
            ),
          ),
          bottomNavigationBar: AnimatedSlide(
            offset: _isBottomNavVisible ? Offset.zero : const Offset(0, 1.5),
            duration: const Duration(milliseconds: 250),
            curve: Curves.fastOutSlowIn,
            child: _BottomNav(current: _currentIndex, onTap: _goToTab),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM NAV — white bg, center floating circle (style lama, warna baru)
// ─────────────────────────────────────────────────────────────────────────────
class _BottomNav extends StatelessWidget {
  final int current;
  final Function(int) onTap;
  const _BottomNav({required this.current, required this.onTap});

  static const _items = [
    _NavData(icon: Icons.home_rounded,           activeIcon: Icons.home_rounded,               label: 'Beranda',   index: 0),
    _NavData(icon: Icons.history_rounded,        activeIcon: Icons.history_rounded,            label: 'Riwayat',   index: 1),
    _NavData(icon: Icons.fingerprint,            activeIcon: Icons.fingerprint,                label: 'Absensi',   index: 2),
    _NavData(icon: Icons.calendar_month_rounded, activeIcon: Icons.calendar_month_rounded,     label: 'Kalender',  index: 3),
    _NavData(icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded,             label: 'Akun',      index: 4),
  ];

  static const int _centerIndex = 2;

  @override
  Widget build(BuildContext context) {
    final safePadBottom = MediaQuery.of(context).padding.bottom;

    return Container(
      color: AppColors.surface, // Background belakang
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          // Background Curved Navbar
          Container(
            height: 70 + safePadBottom,
            decoration: const BoxDecoration(
              color: Color(0xFF160102), // Sangat gelap (hitam kemerahan)
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(30),
                topRight: Radius.circular(30),
              ),
            ),
            child: Padding(
              padding: EdgeInsets.only(bottom: safePadBottom),
              child: Row(
                children: _items.map((item) {
                  final isCenter = item.index == _centerIndex;
                  final isActive = item.index == current;
                  if (isCenter) return const Expanded(child: SizedBox());
                  return Expanded(
                    child: _NavItem(
                      data: item,
                      active: isActive,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        onTap(item.index);
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          // Floating center button
          Positioned(
            top: -26,
            child: _CenterNavButton(
              data: _items[_centerIndex],
              active: current == _centerIndex,
              onTap: () {
                HapticFeedback.mediumImpact();
                onTap(_centerIndex);
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Center floating button ────────────────────────────────────────────────────
class _CenterNavButton extends StatefulWidget {
  final _NavData data;
  final bool active;
  final VoidCallback onTap;
  const _CenterNavButton({required this.data, required this.active, required this.onTap});

  @override
  State<_CenterNavButton> createState() => _CenterNavButtonState();
}

class _CenterNavButtonState extends State<_CenterNavButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
      reverseDuration: const Duration(milliseconds: 200),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.90).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) => _ctrl.reverse(),
      onTapCancel: () => _ctrl.reverse(),
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _scale,
        builder: (_, child) => Transform.scale(scale: _scale.value, child: child),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  colors: [
                    Color(0xFF8B1A1A), // Center red
                    Color(0xFF4A0808), // Outer darker red
                    Color(0xFF160102), // Edge
                  ],
                  radius: 0.8,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.fingerprint,
                color: Colors.white,
                size: 40,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Regular nav item ──────────────────────────────────────────────────────────
class _NavItem extends StatefulWidget {
  final _NavData data;
  final bool active;
  final VoidCallback onTap;
  const _NavItem({required this.data, required this.active, required this.onTap});

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 280));
    _scaleAnim = Tween<double>(begin: 1.0, end: 1.18).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut),
    );
    if (widget.active) _ctrl.forward();
  }

  @override
  void didUpdateWidget(_NavItem old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) {
      _ctrl.forward(from: 0);
    } else if (!widget.active && old.active) {
      _ctrl.reverse();
    }
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final color = widget.active ? const Color(0xFFEF5350) : Colors.white54;
    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, __) => Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Transform.scale(
              scale: widget.active ? _scaleAnim.value : 1.0,
              child: Icon(
                widget.active ? widget.data.activeIcon : widget.data.icon,
                color: color,
                size: 24,
              ),
            ),
            const SizedBox(height: 4),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(
                fontSize: 11,
                fontWeight: widget.active ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
              child: Text(widget.data.label),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavData {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final int index;
  const _NavData({required this.icon, required this.activeIcon, required this.label, required this.index});
}
