import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:full_svg_flutter/full_svg_flutter.dart';
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
import 'leave_approval_screen.dart';
import 'overtime_approval_screen.dart';
import 'create_announcement_screen.dart';
import 'manage_announcements_screen.dart';

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
  // Admin stats
  Map<String, dynamic>? _stats;
  int _pendingLeavesCount = 0;
  int _pendingOvertimesCount = 0;
  bool _loading = true;
  StreamSubscription? _realtimeSub;
  List<Map<String, dynamic>> _recentPendingRequests = [];
  int _activeAnnouncementIndex = 0;

  List<Map<String, dynamic>> _announcements = [];

  final List<Map<String, dynamic>> _defaultAnnouncements = [
    {
      'title': 'Kebijakan Kehadiran Baru',
      'desc': 'Mulai bulan depan, toleransi keterlambatan kehadiran disesuaikan menjadi 10 menit. Harap persiapkan kehadiran Anda.',
      'icon': Icons.info_outline_rounded,
      'color': const Color(0xFF1D4ED8),
      'date': '20 Mei 2026',
    },
    {
      'title': 'Cuti Bersama Hari Raya Nyepi',
      'desc': 'Sesuai keputusan bersama, libur nasional Cuti Bersama jatuh pada Senin depan. Seluruh kantor akan non-aktif.',
      'icon': Icons.celebration_rounded,
      'color': const Color(0xFFF59E0B),
      'date': '18 Mei 2026',
      '_isHoliday': true,
    },
    {
      'title': 'Sosialisasi SOP Kehadiran',
      'desc': 'Harap lakukan verifikasi wajah dengan pencahayaan yang cukup saat melakukan check-in agar sistem mengenali wajah Anda secara akurat.',
      'icon': Icons.face_retouching_natural_rounded,
      'color': const Color(0xFF16A34A),
      'date': '15 Mei 2026',
    },
  ];



  @override
  void initState() {
    super.initState();
    _announcements = List<Map<String, dynamic>>.from(_defaultAnnouncements);
    _loadAllStats();

    _realtimeSub = RealtimeService().events.listen((event) {
      final evName = event['event'];
      if (evName == 'attendance_update' ||
          evName == 'leave_update' ||
          evName == 'overtime_update' ||
          evName == 'notification_update' ||
          evName == 'announcement_update') {
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

      final refreshFuture = context.read<AuthProvider>().refreshProfile();

      // Fetch admin dashboard metrics in parallel
      final results = await Future.wait([
        api.getDashboardStats(),                 // 0
        api.getAllOvertime(status: 'pending'),   // 1
        api.getAllPendingLeaves(),               // 2
        api.getAnnouncements(),                  // 3
      ]);

      await refreshFuture;

      final statsRes = results[0];
      final overtimeRes = results[1];
      final leavesRes = results[2];
      final announcementsRes = results[3];

      // Parse company announcements dynamically
      List<Map<String, dynamic>> parsedAnnouncements = [];
      if (announcementsRes['success'] == true && announcementsRes['announcements'] != null) {
        final List list = announcementsRes['announcements'] as List;
        for (var ann in list) {
          final title = ann['title']?.toString() ?? '';
          final content = ann['content']?.toString() ?? '';
          final type = ann['type']?.toString().toLowerCase() ?? 'info';
          final isHolidayVal = ann['is_holiday'] == 1 || ann['is_holiday'] == true || ann['is_holiday'] == 'true';
          final createdAt = ann['created_at']?.toString();

          String dateStr = '-';
          if (createdAt != null) {
            try {
              final dt = DateTime.parse(createdAt).toLocal();
              dateStr = DateFormat('d MMM yyyy', 'id_ID').format(dt);
            } catch (_) {}
          }

          IconData icon = Icons.info_outline_rounded;
          Color color = const Color(0xFF1D4ED8);

          if (type == 'success') {
            icon = Icons.check_circle_outline_rounded;
            color = AppColors.success;
          } else if (type == 'warning') {
            icon = Icons.warning_amber_rounded;
            color = AppColors.warning;
          } else if (type == 'error') {
            icon = Icons.cancel_outlined;
            color = AppColors.danger;
          }

          if (isHolidayVal) {
            icon = Icons.celebration_rounded;
            color = const Color(0xFFF59E0B);
          }

          parsedAnnouncements.add({
            'title': title,
            'desc': content,
            'icon': icon,
            'color': color,
            'date': dateStr,
            '_isHoliday': isHolidayVal,
          });
        }
      }

      if (parsedAnnouncements.isNotEmpty) {
        _announcements = parsedAnnouncements.take(5).toList();
      } else {
        _announcements = List<Map<String, dynamic>>.from(_defaultAnnouncements);
      }

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

                  // 2. Ringkasan Kehadiran Tim (Admin/HRD overview of employee attendance rate)
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 80),
                    child: _buildStatsSummary(),
                  ),
                  // 3. Grid Menu Title & Grid (Menu Layanan Admin)
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
                          'Menu Layanan Admin/HRD',
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
                  // New Section: Pengumuman Internal
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 110),
                    child: _buildAnnouncementsSection(),
                  ),
                  const SizedBox(height: 24),
                  // New Section: Akumulasi & Analitik Bulanan
                  FadeSlideIn(
                    delay: const Duration(milliseconds: 115),
                    child: _buildMonthlyAccumulationSection(),
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

  // ── Header Section (Redesigned to look exactly like employee header) ───────
  Widget _buildHeader(UserModel? user, int totalRequests) {
    final greeting = _getGreeting();
    final quote = _getMotivationalQuote();
    final greetingIcon = _getGreetingIcon();

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/images/bg-apk.jpg'),
          fit: BoxFit.cover,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Stack(
        children: [
          // Dark overlay for readability
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(28),
                  bottomRight: Radius.circular(28),
                ),
                gradient: LinearGradient(
                  colors: [
                    Colors.black.withOpacity(0.65),
                    Colors.black.withOpacity(0.4),
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
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
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
                              count: totalRequests,
                              child: Container(
                                width: 38, height: 38,
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
                  const SizedBox(height: 20),

                  // Horizontal Profile Row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Avatar on the left
                      Container(
                        width: 60, height: 60,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2.0),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 4))
                          ],
                        ),
                        child: UserAvatar(name: user?.name ?? '', size: 60, avatarFilename: user?.avatar),
                      ),
                      const SizedBox(width: 14),
                      // Greeting and User info on the right
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  greetingIcon,
                                  color: const Color(0xFFFFD54F),
                                  size: 15,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  greeting,
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.85),
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              user?.name ?? 'Admin',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.4,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              user?.deptPosition ?? '-',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.7),
                                fontSize: 11,
                                fontWeight: FontWeight.w400,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Translucent Quote Banner
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.05), width: 1),
                    ),
                    child: Text(
                      quote,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 10.5,
                        height: 1.4,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),

                ],
              ),
            ),
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

  // ── Redesigned 6-Item Admin Grid Menu ─────────────────────────────────────
  Widget _buildGridMenu() {
    final context = this.context;
    final List<Map<String, dynamic>> items = [
      {
        'label': 'Persetujuan\nCuti',
        'iconPath': 'assets/images/01_persetujuan_cuti.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const LeaveApprovalScreen(showAppBar: true)),
        ),
      },
      {
        'label': 'Persetujuan\nLembur',
        'iconPath': 'assets/images/02_persetujuan_lembur.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const OvertimeApprovalScreen(showAppBar: true)),
        ),
      },
      {
        'label': 'Daftar\nKaryawan',
        'iconPath': 'assets/images/03_daftar_karyawan.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const EmployeeDirectoryScreen()),
        ),
      },
      {
        'label': 'Kirim\nSiaran',
        'iconPath': 'assets/images/04_kirim_siaran.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const BroadcastScreen()),
        ),
      },
      {
        'label': 'Kelola\nPengumuman',
        'iconPath': 'assets/images/07_kelola_pengumuman.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const ManageAnnouncementsScreen()),
        ),
      },
      {
        'label': 'Area\nGeofence',
        'iconPath': 'assets/images/05_area_geofence.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const LocationsScreen()),
        ),
      },
      {
        'label': 'Kalender\nTim',
        'iconPath': 'assets/images/06_kalender_tim.svg',
        'onTap': () => widget.onNavigate(3),
      },
    ];

    return GridView.builder(
      padding: EdgeInsets.zero,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        childAspectRatio: 0.74,
        crossAxisSpacing: 8,
        mainAxisSpacing: 16,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return ScaleTap(
          onTap: item['onTap'] as VoidCallback,
          scale: 0.92,
          child: Container(
            color: Colors.transparent,
            child: Column(
              children: [
                IgnorePointer(
                  child: item['iconPath'] != null
                      ? FSvgPicture.asset(
                          item['iconPath'] as String,
                          width: 58,
                          height: 66,
                        )
                      : Container(
                          width: 58,
                          height: 66,
                          alignment: Alignment.center,
                          child: Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: AppColors.primaryBg,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primary.withOpacity(0.12),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Icon(
                              item['icon'] as IconData,
                              color: AppColors.primary,
                              size: 26,
                            ),
                          ),
                        ),
                ),
                const SizedBox(height: 6),
                Text(
                  item['label'] as String,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 11, 
                    fontWeight: FontWeight.w700, 
                    color: AppColors.textSecondary,
                    height: 1.25,
                  ),
                ),
              ],
            ),
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
                  'Aktivitas Pengajuan Terbaru',
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
              onTap: () => widget.onNavigate(1),
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
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.grey200),
              boxShadow: AppColors.cardShadow(),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: const BoxDecoration(
                    color: AppColors.successBg,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.done_all_rounded,
                    color: AppColors.success,
                    size: 28,
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Seluruh Permohonan Telah Diproses',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Belum ada pengajuan baru yang memerlukan persetujuan.',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w500,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
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
                  widget.onNavigate(1);
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

  // ── Announcements Carousel ──────────────────────────────────────────
  Widget _buildAnnouncementsSection() {
    return Column(
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
              'Pengumuman Perusahaan',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 145,
          child: PageView.builder(
            controller: PageController(viewportFraction: 0.94),
            itemCount: _announcements.length,
            onPageChanged: (index) {
              setState(() {
                _activeAnnouncementIndex = index;
              });
            },
            itemBuilder: (context, index) {
              final ann = _announcements[index];
              final Color accentColor = (ann['color'] as Color?) ?? AppColors.primary;
              return Container(
                margin: const EdgeInsets.only(right: 10, bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.grey200),
                  boxShadow: AppColors.cardShadow(),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Stack(
                    children: [
                      // Left colored accent border
                      Positioned(
                        left: 0, top: 0, bottom: 0,
                        child: Container(
                          width: 5,
                          color: accentColor,
                        ),
                      ),
                      // Soft background tint matching accent color
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Colors.white, accentColor.withOpacity(0.015)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(18),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: accentColor.withOpacity(0.08),
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          ann['_isHoliday'] == true ? 'Hari Libur' : 'Info',
                                          style: TextStyle(
                                            color: accentColor,
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.2,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        ann['date'] as String,
                                        style: const TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w500),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    ann['title'] as String,
                                    style: const TextStyle(
                                      color: AppColors.textPrimary, 
                                      fontSize: 13.5, 
                                      fontWeight: FontWeight.w800, 
                                      letterSpacing: -0.2
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    ann['desc'] as String,
                                    style: const TextStyle(
                                      color: AppColors.textSecondary, 
                                      fontSize: 11, 
                                      height: 1.35
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: accentColor.withOpacity(0.08),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                (ann['icon'] as IconData?) ?? Icons.campaign_rounded, 
                                color: accentColor, 
                                size: 22
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            _announcements.length,
            (index) => AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              height: 4,
              width: _activeAnnouncementIndex == index ? 12 : 4,
              decoration: BoxDecoration(
                color: _activeAnnouncementIndex == index ? AppColors.primary : AppColors.grey300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Monthly Accumulation Board ──────────────────────────────────────
  Widget _buildMonthlyAccumulationSection() {
    final totalEmployees = _stats?['total_employees'] ?? 0;
    final presentToday = _stats?['present_today'] ?? 0;
    final monthlyAttendance = _stats?['monthly_attendance'] ?? 0;
    final double attendanceRate = totalEmployees > 0 ? (presentToday / totalEmployees) * 100 : 0.0;

    return Column(
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
              'Ikhtisar Kinerja Bulanan',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.grey200),
                  boxShadow: AppColors.cardShadow(),
                  gradient: LinearGradient(
                    colors: [Colors.white, const Color(0xFFEFF6FF).withOpacity(0.15)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.blue.withOpacity(0.15),
                            blurRadius: 8,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      child: const Icon(Icons.check_circle_outline_rounded, color: Colors.blue, size: 22),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Kehadiran Kumulatif',
                      style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$monthlyAttendance Kali',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary, letterSpacing: -0.5),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.grey200),
                  boxShadow: AppColors.cardShadow(),
                  gradient: LinearGradient(
                    colors: [Colors.white, const Color(0xFFF0FDF4).withOpacity(0.15)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.green.withOpacity(0.15),
                            blurRadius: 8,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      child: const Icon(Icons.trending_up_rounded, color: Colors.green, size: 22),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Rasio Kehadiran Hari Ini',
                      style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${attendanceRate.round()}%',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary, letterSpacing: -0.5),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
