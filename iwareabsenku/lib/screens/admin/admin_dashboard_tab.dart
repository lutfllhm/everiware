import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/realtime_service.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/animations.dart';
import '../../widgets/glass_widgets.dart';
import 'employee_directory_screen.dart';
import 'locations_screen.dart';
import 'broadcast_screen.dart';

class AdminDashboardTab extends StatefulWidget {
  final Function(int) onNavigate;
  final VoidCallback onNotifTap;
  final int unreadNotif;

  const AdminDashboardTab({
    super.key,
    required this.onNavigate,
    required this.onNotifTap,
    required this.unreadNotif,
  });

  @override
  State<AdminDashboardTab> createState() => _AdminDashboardTabState();
}

class _AdminDashboardTabState extends State<AdminDashboardTab> {
  Map<String, dynamic>? _stats;
  int _pendingLeavesCount = 0;
  int _pendingOvertimesCount = 0;
  bool _loading = true;
  StreamSubscription? _realtimeSub;
  List<Map<String, dynamic>> _recentPendingRequests = [];

  @override
  void initState() {
    super.initState();
    _loadAllStats();

    _realtimeSub = RealtimeService().events.listen((event) {
      final evName = event['event'];
      if (evName == 'attendance_update' ||
          evName == 'leave_update' ||
          evName == 'overtime_update' ||
          evName == 'notification_update') {
        _loadAllStats();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  Future<void> _loadAllStats() async {
    try {
      final api = ApiService();
      final results = await Future.wait([
        api.getDashboardStats(),                 // 0
        api.getAllOvertime(status: 'pending'),   // 1
        api.getAllPendingLeaves(),               // 2
      ]);

      final statsRes = results[0];
      final overtimeRes = results[1];
      final leavesRes = results[2];

      List<Map<String, dynamic>> recent = [];
      
      // Parse pending leaves into recents
      if (leavesRes['success'] == true && leavesRes['leaves'] != null) {
        final List leaves = leavesRes['leaves'] as List;
        for (var l in leaves) {
          recent.add({
            'id': l['id'],
            'type': 'leave',
            'typeLabel': l['type'] == 'annual' ? 'Cuti' : 'Izin',
            'userName': l['user_name'] ?? '-',
            'date': l['start_date'] ?? '-',
            'desc': l['reason'] ?? '-',
            'timestamp': DateTime.tryParse(l['created_at'] ?? '') ?? DateTime.now(),
          });
        }
      }

      // Parse pending overtimes into recents
      if (overtimeRes['success'] == true && overtimeRes['overtimes'] != null) {
        final List overtimes = overtimeRes['overtimes'] as List;
        for (var o in overtimes) {
          recent.add({
            'id': o['id'],
            'type': 'overtime',
            'typeLabel': 'Lembur',
            'userName': o['user_name'] ?? '-',
            'date': o['date'] ?? '-',
            'desc': o['reason'] ?? '-',
            'timestamp': DateTime.tryParse(o['created_at'] ?? '') ?? DateTime.now(),
          });
        }
      }

      // Sort by timestamp descending
      recent.sort((a, b) => (b['timestamp'] as DateTime).compareTo(a['timestamp'] as DateTime));

      if (mounted) {
        setState(() {
          _stats = statsRes['stats'];
          _pendingLeavesCount = _stats?['pending_leaves'] ?? 0;
          _pendingOvertimesCount = (overtimeRes['overtimes'] as List? ?? []).length;
          _recentPendingRequests = recent.take(3).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 0 && hour < 11) {
      return 'Selamat Pagi';
    } else if (hour >= 11 && hour < 15) {
      return 'Selamat Siang';
    } else if (hour >= 15 && hour < 18) {
      return 'Selamat Sore';
    } else {
      return 'Selamat Malam';
    }
  }

  IconData _getGreetingIcon() {
    final hour = DateTime.now().hour;
    if (hour >= 0 && hour < 11) {
      return Icons.light_mode_rounded;
    } else if (hour >= 11 && hour < 15) {
      return Icons.wb_sunny_rounded;
    } else if (hour >= 15 && hour < 18) {
      return Icons.wb_twilight_rounded;
    } else {
      return Icons.nights_stay_rounded;
    }
  }

  String _getMotivationalQuote() {
    final day = DateTime.now().day;
    final quotes = [
      'Kepemimpinan yang baik dimulai dari keteladanan harian.',
      'Dukung tim kita hari ini untuk mencapai performa terbaik bersama.',
      'Prioritaskan keselamatan, kenyamanan, dan integritas kerja seluruh tim.',
      'Sinergi dan kolaborasi adalah jembatan menuju efisiensi kerja.',
      'Setiap persetujuan cepat Anda membantu kelancaran operasional karyawan.',
      'Kehadiran dan dedikasi tim adalah aset paling berharga bagi perusahaan.',
      'Apresiasi setiap kontribusi karyawan untuk membangun iklim kerja positif.'
    ];
    return quotes[day % quotes.length];
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final totalRequests = _pendingLeavesCount + _pendingOvertimesCount;

    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FD),
      body: RefreshIndicator(
        onRefresh: _loadAllStats,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _buildHeader(user, totalRequests),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // 1. Greeting Section
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 50),
                    child: _buildGreetingSection(user),
                  ),
                  // 2. Statistics Summary
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 80),
                    child: _buildStatsSummary(),
                  ),
                  // 3. Grid Menu Title & Grid
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16, top: 4),
                    child: Row(
                      children: [
                        Container(
                          width: 4,
                          height: 18,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.primary, AppColors.primaryLight],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'Menu Layanan Admin',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 100),
                    child: _buildGridMenu(),
                  ),
                  const SizedBox(height: 24),
                  // 4. Pending Requests List Section
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 120),
                    child: _buildRecentRequestsSection(),
                  ),
                  const SizedBox(height: 90),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Header Section ─────────────────────────────────────────────────────────
  Widget _buildHeader(UserModel? user, int totalRequests) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/images/bg-apk.jpg'),
          fit: BoxFit.cover,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(36),
          bottomRight: Radius.circular(36),
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(36),
                  bottomRight: Radius.circular(36),
                ),
                gradient: LinearGradient(
                  colors: [
                    Colors.black.withOpacity(0.55),
                    Colors.black.withOpacity(0.35),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
              child: Column(
                children: [
                  // Top Bar
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Logo
                      RichText(
                        text: TextSpan(
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            fontStyle: FontStyle.italic,
                            fontFamily: 'Usuzi',
                          ),
                          children: [
                            const TextSpan(text: 'EV'),
                            WidgetSpan(
                              alignment: PlaceholderAlignment.middle,
                              child: Padding(
                                padding: const EdgeInsets.only(left: 3, right: 1),
                                child: Image.asset(
                                  'assets/images/iwaa.png',
                                  width: 22,
                                  height: 22,
                                ),
                              ),
                            ),
                            const TextSpan(text: 'RIWARE'),
                          ],
                        ),
                      ),
                      const Spacer(),
                      // Notification & Date
                      Row(
                        children: [
                          ScaleTap(
                            onTap: widget.onNotifTap,
                            scale: 0.92,
                            child: PulseBadge(
                              count: totalRequests, // Show pending requests as unread count in badge
                              child: Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.white.withOpacity(0.12), width: 1),
                                ),
                                child: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 22),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            DateFormat('EEEE, d MMM yyyy', 'id_ID').format(DateTime.now()),
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Profile Avatar
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3.5),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 12, offset: const Offset(0, 6))
                      ],
                    ),
                    child: UserAvatar(name: user?.name ?? '', size: 96, avatarFilename: user?.avatar),
                  ),
                  const SizedBox(height: 16),

                  // Profile Info
                  Text(
                    user?.name ?? 'Admin',
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.5),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        user?.roleLabel ?? 'Admin',
                        style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 13, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),

                  // 3D Action Buttons (Leaves and Overtime Approvals)
                  Row(
                    children: [
                      Expanded(
                        child: _buildMainActionButton(
                          title: 'Persetujuan Cuti',
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFF8E0E5D), // Deep magenta/plum
                              Color(0xFFC2185B), // Rich ruby pink
                              Color(0xFFEC407A), // Bright pink
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shadowColor: const Color(0xFF3B001F),
                          icon: const Icon(Icons.assignment_turned_in_rounded, color: Colors.white, size: 36),
                          onTap: () {
                            HapticFeedback.mediumImpact();
                            widget.onNavigate(1); // Navigates to approvals tab
                          },
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildMainActionButton(
                          title: 'Persetujuan Lembur',
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFF8E0E5D), // Deep magenta/plum
                              Color(0xFFC2185B), // Rich ruby pink
                              Color(0xFFEC407A), // Bright pink
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shadowColor: const Color(0xFF3B001F),
                          icon: const Icon(Icons.more_time_rounded, color: Colors.white, size: 36),
                          onTap: () {
                            HapticFeedback.mediumImpact();
                            // Open approvals tab and focus lembur
                            widget.onNavigate(1);
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainActionButton({
    required String title,
    required Gradient gradient,
    required Color shadowColor,
    required Widget icon,
    required VoidCallback onTap,
  }) {
    return ScaleTap(
      onTap: onTap,
      scale: 0.94,
      child: Container(
        height: 112,
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: shadowColor.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 8),
            ),
            BoxShadow(
              color: shadowColor.withOpacity(0.7),
              blurRadius: 0,
              offset: const Offset(0, 4),
            ),
          ],
          border: Border.all(color: const Color(0xFFEC407A).withOpacity(0.55), width: 1.5),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 64,
              height: 48,
              child: Center(child: icon),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  // ── Greeting Section ───────────────────────────────────────────────────────
  Widget _buildGreetingSection(UserModel? user) {
    final greeting = _getGreeting();
    final quote = _getMotivationalQuote();
    final icon = _getGreetingIcon();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.primaryBorder.withOpacity(0.35), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 16,
            spreadRadius: 0,
            offset: const Offset(0, 6),
          )
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$greeting, ${user?.name ?? "Admin"} 👋',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.2),
                ),
                const SizedBox(height: 6),
                Text(
                  quote,
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppColors.primary, size: 20),
          ),
        ],
      ),
    );
  }

  // ── Team Attendance Stats Summary ──────────────────────────────────────────
  Widget _buildStatsSummary() {
    final totalEmployees = _stats?['total_employees'] ?? 0;
    final presentToday = _stats?['present_today'] ?? 0;
    final pendingLeaves = _stats?['pending_leaves'] ?? 0;

    final absentCount = totalEmployees > 0 ? (totalEmployees - presentToday - pendingLeaves).clamp(0, totalEmployees) : 0;
    final double attendanceRate = totalEmployees > 0 ? presentToday / totalEmployees : 0.0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.grey200, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 16,
            spreadRadius: 0,
            offset: const Offset(0, 6),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4,
                height: 18,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryLight],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Ringkasan Kehadiran Tim (Hari Ini)',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              // Progress Ring Visual
              Container(
                width: 82,
                height: 82,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xFFEFF6FF),
                ),
                child: Center(
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      SizedBox(
                        width: 70,
                        height: 70,
                        child: CircularProgressIndicator(
                          value: _loading ? 0 : attendanceRate,
                          strokeWidth: 7,
                          backgroundColor: Colors.white,
                          color: AppColors.primary,
                          strokeCap: StrokeCap.round,
                        ),
                      ),
                      Text(
                        _loading ? '0%' : '${(attendanceRate * 100).round()}%',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 20),
              // Stats details
              Expanded(
                child: Column(
                  children: [
                    _buildStatRow('Karyawan Aktif', '$totalEmployees', Colors.blueGrey),
                    const SizedBox(height: 8),
                    _buildStatRow('Hadir Hari Ini', '$presentToday', AppColors.teal),
                    const SizedBox(height: 8),
                    _buildStatRow('Cuti/Izin Sakit', '$pendingLeaves', AppColors.warning),
                    const SizedBox(height: 8),
                    _buildStatRow('Tidak Absen', '$absentCount', AppColors.danger),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(shape: BoxShape.circle, color: color),
            ),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
          ],
        ),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }

  // ── 3-Item Grid Menu ───────────────────────────────────────────────────────
  Widget _buildGridMenu() {
    final context = this.context;
    final List<Map<String, dynamic>> items = [
      {
        'label': 'Daftar\nKaryawan',
        'colors': [const Color(0xFF3F51B5), const Color(0xFF2196F3)],
        'shadow': const Color(0xFF2196F3),
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const EmployeeDirectoryScreen()),
        ),
        'child': const Icon(Icons.people_alt_rounded, color: Colors.white, size: 16),
      },
      {
        'label': 'Kirim\nSiaran',
        'colors': [const Color(0xFFFFB300), const Color(0xFFFF6D00)],
        'shadow': const Color(0xFFFF6D00),
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const BroadcastScreen()),
        ),
        'child': const Icon(Icons.campaign_rounded, color: Colors.white, size: 16),
      },
      {
        'label': 'Area\nGeofence',
        'colors': [const Color(0xFF00BCD4), const Color(0xFF00E5FF)],
        'shadow': const Color(0xFF00E5FF),
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const LocationsScreen()),
        ),
        'child': const Icon(Icons.map_rounded, color: Colors.white, size: 16),
      },
      {
        'label': 'Kalender\nTim',
        'colors': [const Color(0xFF2E7D32), const Color(0xFF00E676)],
        'shadow': const Color(0xFF00E676),
        'onTap': () => widget.onNavigate(3), // Navigate to calendar tab (index 3)
        'child': const Icon(Icons.calendar_month_rounded, color: Colors.white, size: 16),
      },
    ];

    return GridView.builder(
      padding: EdgeInsets.zero,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        childAspectRatio: 0.76,
        crossAxisSpacing: 8,
        mainAxisSpacing: 16,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return ScaleTap(
          onTap: item['onTap'] as VoidCallback,
          scale: 0.92,
          child: Column(
            children: [
              Glossy3dIcon(
                bgGradientColors: item['colors'] as List<Color>,
                shadowColor: item['shadow'] as Color,
                child: item['child'] as Widget,
              ),
              const SizedBox(height: 8),
              Text(
                item['label'] as String,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF37474F)),
              ),
            ],
          ),
        );
      },
    );
  }

  // ── Recent Requests Section ────────────────────────────────────────────────
  Widget _buildRecentRequestsSection() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 4,
                  height: 18,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.primaryLight],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'Pengajuan Terbaru',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
            GestureDetector(
              onTap: () => widget.onNavigate(1), // Open approvals tab
              child: const Text(
                'Lihat Semua',
                style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_loading)
          const Center(child: CircularProgressIndicator())
        else if (_recentPendingRequests.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.grey200),
            ),
            child: const Center(
              child: Text(
                'Tidak ada pengajuan pending saat ini.',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w500),
              ),
            ),
          )
        else
          ListView.separated(
            padding: EdgeInsets.zero,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _recentPendingRequests.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final req = _recentPendingRequests[index];
              return AppCard(
                onTap: () {
                  HapticFeedback.lightImpact();
                  widget.onNavigate(1); // Open approvals tab
                },
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: req['type'] == 'leave' ? AppColors.warningBg : AppColors.primaryBg,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        req['type'] == 'leave' ? Icons.assignment_turned_in_rounded : Icons.more_time_rounded,
                        color: req['type'] == 'leave' ? AppColors.warning : AppColors.primary,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            req['userName'],
                            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${req['typeLabel']} - ${req['desc']}',
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Text(
                      req['date'],
                      style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}
