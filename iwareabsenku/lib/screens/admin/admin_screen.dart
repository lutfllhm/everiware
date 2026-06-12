import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../services/realtime_service.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import 'admin_dashboard_tab.dart';
import 'admin_approvals_tab.dart';
import 'today_attendance_screen.dart';
import 'team_calendar_screen.dart';
import 'admin_profile_tab.dart';
import '../../widgets/animations.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> with WidgetsBindingObserver {
  int _currentIndex = 0;
  bool _isBottomNavVisible = true;
  int _unreadRequests = 0;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _fetchUnreadRequests();

    _realtimeSub = RealtimeService().events.listen((event) {
      final evName = event['event'];
      if (evName == 'leave_update' ||
          evName == 'overtime_update' ||
          evName == 'attendance_update') {
        _fetchUnreadRequests();
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _realtimeSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final auth = context.read<AuthProvider>();
      if (auth.isAuthenticated && auth.token != null) {
        debugPrint('📱 Admin App resumed, force reconnecting SSE...');
        RealtimeService().disconnect();
        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted && auth.isAuthenticated && auth.token != null) {
            RealtimeService().connect(auth.token!);
            _fetchUnreadRequests();
          }
        });
      }
    }
  }

  Future<void> _fetchUnreadRequests() async {
    try {
      final results = await Future.wait([
        ApiService().getAllPendingLeaves(),
        ApiService().getAllOvertime(status: 'pending'),
      ]);
      final leaves = results[0]['leaves'] as List? ?? [];
      final overtimes = results[1]['overtimes'] as List? ?? [];
      if (mounted) {
        setState(() {
          _unreadRequests = leaves.length + overtimes.length;
        });
      }
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

  DateTime? _lastBackPress;

  @override
  Widget build(BuildContext context) {
    final pages = [
      AdminDashboardTab(
        onNavigate: _goToTab,
        onNotifTap: () => _goToTab(1), // Navigates to approvals tab
        unreadNotif: _unreadRequests,
      ),
      const AdminApprovalsTab(),
      const TodayAttendanceScreen(showAppBar: false),
      const TeamCalendarScreen(showAppBar: false),
      const AdminProfileTab(),
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
            child: _BottomNav(current: _currentIndex, onTap: _goToTab, unreadRequests: _unreadRequests),
          ),
        ),
      ),
    );
  }
}

class _BottomNav extends StatelessWidget {
  final int current;
  final Function(int) onTap;
  final int unreadRequests;
  const _BottomNav({required this.current, required this.onTap, required this.unreadRequests});

  static const _items = [
    _NavData(icon: Icons.home_outlined,           activeIcon: Icons.home_rounded,               label: 'Beranda',      index: 0),
    _NavData(icon: Icons.assignment_turned_in_outlined, activeIcon: Icons.assignment_turned_in_rounded, label: 'Persetujuan', index: 1),
    _NavData(icon: Icons.co_present_outlined,     activeIcon: Icons.co_present_rounded,         label: 'Kehadiran',    index: 2),
    _NavData(icon: Icons.calendar_month_outlined, activeIcon: Icons.calendar_month_rounded,     label: 'Kalender',     index: 3),
    _NavData(icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded,             label: 'Akun',         index: 4),
  ];

  static const int _centerIndex = 2;

  @override
  Widget build(BuildContext context) {
    final safePadBottom = MediaQuery.of(context).padding.bottom;

    return Container(
      color: AppColors.surface,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          Container(
            height: 70 + safePadBottom,
            decoration: const BoxDecoration(
              color: Color(0xFF160102),
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
                      badgeCount: item.index == 1 ? unreadRequests : 0,
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
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

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
                    Color(0xFF8B1A1A),
                    Color(0xFF4A0808),
                    Color(0xFF160102),
                  ],
                  radius: 0.8,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.5),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(
                widget.data.icon,
                color: Colors.white,
                size: 34,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatefulWidget {
  final _NavData data;
  final bool active;
  final int badgeCount;
  final VoidCallback onTap;
  const _NavItem({required this.data, required this.active, required this.badgeCount, required this.onTap});

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
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

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
            Stack(
              clipBehavior: Clip.none,
              children: [
                Transform.scale(
                  scale: widget.active ? _scaleAnim.value : 1.0,
                  child: Icon(
                    widget.active ? widget.data.activeIcon : widget.data.icon,
                    color: color,
                    size: 24,
                  ),
                ),
                if (widget.badgeCount > 0)
                  Positioned(
                    top: -4,
                    right: -6,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        '${widget.badgeCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
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
