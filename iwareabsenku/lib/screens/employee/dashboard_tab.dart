import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/auth_provider.dart';
import '../../services/api_service.dart';
import '../../services/realtime_service.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/animations.dart';
import '../../widgets/glass_widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:full_svg_flutter/full_svg_flutter.dart';
import 'attendance_screen.dart';
import 'request_form_screen.dart';
import 'my_stats_screen.dart';

class DashboardTab extends StatefulWidget {
  final Function(int) onNavigate;
  final VoidCallback onNotifTap;
  final int unreadNotif;
  final int offlinePending;
  final VoidCallback onSyncTap;
  const DashboardTab({
    super.key,
    required this.onNavigate,
    required this.onNotifTap,
    required this.unreadNotif,
    this.offlinePending = 0,
    required this.onSyncTap,
  });
  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> with WidgetsBindingObserver {
  Map<String, dynamic>? _quota;
  Map<String, dynamic>? _todayAttendance;
  Map<String, dynamic>? _workInfo;
  int _presentCount = 0;
  int _lateCount = 0;
  int _leaveSickCount = 0;
  int _activeAnnouncementIndex = 0;
  StreamSubscription? _realtimeSub;

  // ── Data baru: Shift, Leaves, Overtime, GPS ──────────────────────────────
  Map<String, dynamic>? _myShift;
  List<Map<String, dynamic>> _recentLeaves = [];
  List<Map<String, dynamic>> _overtimeList = [];
  int _approvedOvertimeMinutes = 0;
  List<Map<String, dynamic>> _officeLocations = [];

  // GPS state
  String _gpsStatus = 'loading'; // loading | in_range | out_range | error
  String _gpsMessage = 'Mengecek lokasi...';
  String? _nearestOfficeName;
  double? _distanceToOffice;

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
    WidgetsBinding.instance.addObserver(this);
    _loadData();

    _realtimeSub = RealtimeService().events.listen((event) {
      final evName = event['event'];
      if (evName == 'attendance_update' ||
          evName == 'leave_update' ||
          evName == 'overtime_update' ||
          evName == 'notification_update' ||
          evName == 'announcement_update') {
        _loadData();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _loadData();
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final api = ApiService();
      final now = DateTime.now();

      // Refresh user profile info from server in parallel
      final refreshFuture = context.read<AuthProvider>().refreshProfile();

      // Panggil semua API secara paralel
      final results = await Future.wait([
        api.getLeaveQuota(),           // 0
        api.getTodayAttendance(),       // 1
        api.getMyShift(),              // 2
        api.getMyLeaves(),             // 3
        api.getMyOvertime(),           // 4
        api.getLocations(),            // 5
        api.getHolidays(year: now.year), // 6
        api.getMyAttendance(month: now.month, year: now.year), // 7
        api.getAnnouncements(),        // 8
      ]);

      // Tunggu hingga profile refresh selesai
      await refreshFuture;

      final quotaRes = results[0];
      final todayRes = results[1];
      final shiftRes = results[2];
      final leavesRes = results[3];
      final overtimeRes = results[4];
      final locationsRes = results[5];
      final holidaysRes = results[6];
      final attRes = results[7];
      final announcementsRes = results[8];

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

      // Hitung statistik kehadiran bulanan
      int present = 0, lateCount = 0, leaveSick = 0;
      try {
        if (attRes['success'] == true && attRes['attendances'] != null) {
          for (var att in attRes['attendances']) {
            final status = att['status'];
            if (status == 'present') present++;
            else if (status == 'late') lateCount++;
            else if (status == 'leave' || status == 'sick') leaveSick++;
          }
        }
      } catch (e) {
        debugPrint('Error loading attendance summary: $e');
      }

      // Parse shift data
      Map<String, dynamic>? myShift;
      if (shiftRes['success'] == true && shiftRes['shift'] != null) {
        myShift = Map<String, dynamic>.from(shiftRes['shift']);
      }

      // Parse recent leaves (max 3 terbaru)
      List<Map<String, dynamic>> recentLeaves = [];
      if (leavesRes['success'] == true && leavesRes['leaves'] != null) {
        final allLeaves = (leavesRes['leaves'] as List).cast<Map<String, dynamic>>();
        recentLeaves = allLeaves.take(3).toList();
      }

      // Parse overtime & hitung total jam disetujui bulan ini
      List<Map<String, dynamic>> overtimeList = [];
      int approvedOtMinutes = 0;
      if (overtimeRes['success'] == true && overtimeRes['overtimes'] != null) {
        final allOt = (overtimeRes['overtimes'] as List).cast<Map<String, dynamic>>();
        overtimeList = allOt.take(3).toList();
        for (var ot in allOt) {
          if (ot['status'] == 'approved') {
            try {
              final otDate = DateTime.parse(ot['date'].toString());
              if (otDate.month == now.month && otDate.year == now.year) {
                approvedOtMinutes += (ot['duration_minutes'] as num?)?.toInt() ?? 0;
              }
            } catch (_) {}
          }
        }
      }

      // Parse office locations
      List<Map<String, dynamic>> officeLocations = [];
      if (locationsRes['success'] == true && locationsRes['locations'] != null) {
        officeLocations = (locationsRes['locations'] as List).cast<Map<String, dynamic>>();
      }

      // Tambahkan hari libur terdekat (30 hari ke depan) ke pengumuman
      if (holidaysRes['success'] == true && holidaysRes['holidays'] != null) {
        final holidays = (holidaysRes['holidays'] as List).cast<Map<String, dynamic>>();
        final today = DateTime(now.year, now.month, now.day);
        // Hapus holiday announcement lama
        _announcements.removeWhere((a) => a['_isHoliday'] == true);
        for (var h in holidays) {
          try {
            final hDate = DateTime.parse(h['date'].toString());
            final diff = hDate.difference(today).inDays;
            if (diff >= 0 && diff <= 30) {
              _announcements.insert(0, {
                'title': '🎉 ${h['name']}',
                'desc': 'Hari libur nasional pada ${DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(hDate)}. Kantor tidak beroperasi.',
                'icon': Icons.event_rounded,
                'color': const Color(0xFFE53935),
                'date': DateFormat('d MMM yyyy').format(hDate),
                '_isHoliday': true,
              });
            }
          } catch (_) {}
        }
      }

      if (mounted) {
        setState(() {
          _quota = quotaRes['quota'];
          if (todayRes['success'] == true) {
            _todayAttendance = todayRes['attendance'];
            _workInfo = todayRes['work_info'];
          }
          _presentCount = present;
          _lateCount = lateCount;
          _leaveSickCount = leaveSick;
          _myShift = myShift;
          _recentLeaves = recentLeaves;
          _overtimeList = overtimeList;
          _approvedOvertimeMinutes = approvedOtMinutes;
          _officeLocations = officeLocations;
        });
      }

      // Cek GPS setelah data lokasi kantor didapat
      _checkGpsStatus();
    } catch (e) {
      debugPrint('Error loading dashboard data: $e');
    }
  }

  Future<void> _checkGpsStatus() async {
    final user = context.read<AuthProvider>().user;
    if (_officeLocations.isEmpty) {
      if (mounted) {
        setState(() {
          _gpsStatus = 'error';
          _gpsMessage = 'Tidak ada lokasi kantor terdaftar';
        });
      }
      return;
    }
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          setState(() {
            _gpsStatus = 'error';
            _gpsMessage = 'GPS tidak aktif. Aktifkan GPS di pengaturan.';
          });
        }
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
        if (mounted) {
          setState(() {
            _gpsStatus = 'error';
            _gpsMessage = 'Izin lokasi ditolak. Aktifkan di pengaturan.';
          });
        }
        return;
      }
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 8),
        );
      } catch (e) {
        debugPrint('getCurrentPosition failed, trying getLastKnownPosition: $e');
        try {
          position = await Geolocator.getLastKnownPosition();
        } catch (innerErr) {
          debugPrint('getLastKnownPosition also failed: $innerErr');
        }
      }

      if (position == null) {
        throw Exception('Akses GPS bermasalah atau timeout. Harap pastikan GPS Anda aktif.');
      }

      // Filter lokasi: jika karyawan memiliki lokasi penempatan, gunakan lokasi tersebut saja.
      final userLocId = user?.locationId;
      Iterable<Map<String, dynamic>> targetLocations = _officeLocations;
      if (userLocId != null && userLocId.isNotEmpty) {
        targetLocations = _officeLocations.where((loc) => loc['id'] == userLocId);
      }

      if (targetLocations.isEmpty) {
        if (mounted) {
          setState(() {
            _gpsStatus = 'error';
            _gpsMessage = userLocId != null && userLocId.isNotEmpty
                ? 'Lokasi penempatan Anda (${user?.locationName ?? "Unknown"}) tidak ditemukan'
                : 'Tidak ada lokasi kantor terdaftar';
          });
        }
        return;
      }

      // Cari kantor terdekat dari target yang valid
      double minDist = double.infinity;
      String? nearestName;
      double nearestRadius = 100;
      for (var loc in targetLocations) {
        final lat = double.tryParse(loc['latitude']?.toString() ?? '') ?? 0.0;
        final lng = double.tryParse(loc['longitude']?.toString() ?? '') ?? 0.0;
        final dist = Geolocator.distanceBetween(position.latitude, position.longitude, lat, lng);
        if (dist < minDist) {
          minDist = dist;
          nearestName = loc['name']?.toString();
          nearestRadius = double.tryParse(loc['radius']?.toString() ?? '') ?? 100.0;
        }
      }

      if (mounted) {
        setState(() {
          _nearestOfficeName = nearestName;
          _distanceToOffice = minDist;
          if (minDist <= nearestRadius) {
            _gpsStatus = 'in_range';
            _gpsMessage = 'Anda berada di area $nearestName';
          } else {
            _gpsStatus = 'out_range';
            _gpsMessage = userLocId != null && userLocId.isNotEmpty
                ? 'Di luar area penempatan: ${(minDist / 1000).toStringAsFixed(1)} km dari $nearestName'
                : '${(minDist / 1000).toStringAsFixed(1)} km dari $nearestName';
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _gpsStatus = 'error';
          _gpsMessage = e is Exception ? e.toString().replaceAll('Exception: ', '') : 'Gagal mendapatkan lokasi: $e';
        });
      }
    }
  }

  void _openWhatsApp() async {
    const phone = '6281249749282'; // Nomor HRD
    final message = Uri.encodeComponent('Halo HRD, saya ingin bertanya mengenai kehadiran/cuti. Terima kasih.');
    final url = Uri.parse('https://wa.me/$phone?text=$message');
    try {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tidak dapat membuka WhatsApp'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _openCamera(String mode) async {
    HapticFeedback.mediumImpact();
    try {
      final cameras = await availableCameras();
      if (!mounted) return;
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => CameraScreen(cameras: cameras, mode: mode)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Kamera tidak tersedia: $e'),
        backgroundColor: AppColors.grey900,
      ));
    }
  }

  String _formatTime(String? dateTimeStr) {
    if (dateTimeStr == null || dateTimeStr.isEmpty) return '--:--';
    try {
      final dt = DateTime.parse(dateTimeStr).toLocal();
      return DateFormat('HH:mm').format(dt);
    } catch (_) {
      return '--:--';
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
      'Semangat bekerja! Setiap usaha terbaikmu hari ini adalah bekal kesuksesan hari esok.',
      'Ayo berikan performa terbaikmu hari ini untuk masa depan yang lebih gemilang!',
      'Kesehatan dan keselamatan kerja adalah yang utama. Selamat beraktivitas!',
      'Fokus, kerja keras, dan konsistensi adalah kunci mencapai kesuksesan bersama.',
      'Jadikan hari ini lebih baik dari kemarin dengan dedikasi dan profesionalisme tinggi.',
      'Kerja sama tim yang solid melahirkan hasil yang luar biasa. Semangat!',
      'Setiap kontribusi kecilmu sangat berharga bagi kemajuan perusahaan.'
    ];
    return quotes[day % quotes.length];
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F8FD), // Light bluish white background like mockup
        body: RefreshIndicator(
          onRefresh: _loadData,
          color: AppColors.primary,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: _buildHeader(user),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    if (widget.offlinePending > 0)
                      ScaleTap(
                        onTap: widget.onSyncTap,
                        scale: 0.96,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 20),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFBEB),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFFDE68A)),
                          ),
                          child: Row(children: [
                            const Icon(Icons.cloud_off_rounded, color: AppColors.warning, size: 18),
                            const SizedBox(width: 10),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('${widget.offlinePending} absensi menunggu sinkronisasi',
                                  style: const TextStyle(color: AppColors.warning, fontWeight: FontWeight.w700, fontSize: 13)),
                              const Text('Tap untuk sync sekarang', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                            ])),
                            const Icon(Icons.sync_rounded, color: AppColors.warning, size: 18),
                          ]),
                        ),
                      ),

                    // 1. Today's Shift & Attendance Card (Greeting is now in header)
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 50),
                      child: _buildShiftStatusCard(),
                    ),
                    // 3. Grid Menu Title & Grid
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16, top: 4),
                      child: Row(
                        children: [
                          Container(
                            width: 4, height: 18,
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
                            'Menu Layanan Mandiri',
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
                    // 4. Monthly Attendance Stats Summary
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 120),
                      child: _buildStatsSummary(),
                    ),
                    // 5. Quota Card (if available)
                    if (_quota != null) ...[
                      FadeSlideIn(
                        delay: const Duration(milliseconds: 140),
                        child: _buildQuotaCard(),
                      ),
                      const SizedBox(height: 20),
                    ],
                    // 6. Announcements Carousel
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 160),
                      child: _buildAnnouncementsSection(),
                    ),
                    // 7. Recent Requests Section
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 180),
                      child: _buildRecentRequestsSection(),
                    ),
                    // 8. Helpdesk Banner
                    FadeSlideIn(
                      delay: const Duration(milliseconds: 200),
                      child: _buildHelpdeskBanner(),
                    ),
                    const SizedBox(height: 90), // Space for bottom nav
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Header Section ─────────────────────────────────────────────────────────
  Widget _buildHeader(UserModel? user) {
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
                      // Notification and Date
                      Row(
                        children: [
                          ScaleTap(
                            onTap: widget.onNotifTap,
                            scale: 0.92,
                            child: PulseBadge(
                              count: widget.unreadNotif,
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

                  // Horizontal Profile Row integrating Greeting
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
                                  color: const Color(0xFFFFD54F), // amber/yellow
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
                              user?.name ?? 'Karyawan',
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
                  const SizedBox(height: 16),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: _buildMainActionButton(
                          title: 'Absen Masuk',
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFF8B1F1F), // Crimson Red
                              Color(0xFF5A0F11), // Dark Wine Red
                              Color(0xFF360507), // Blackish Burgundy
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shadowColor: const Color(0xFF160102),
                          borderColor: const Color(0xFF8B1F1F),
                          iconPath: 'assets/images/masuk_top.png',
                          onTap: () => _openCamera('in'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildMainActionButton(
                          title: 'Absen Pulang',
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFF8B1F1F), // Crimson Red
                              Color(0xFF5A0F11), // Dark Wine Red
                              Color(0xFF360507), // Blackish Burgundy
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shadowColor: const Color(0xFF160102),
                          borderColor: const Color(0xFF8B1F1F),
                          iconPath: 'assets/images/keluar_top.png',
                          onTap: () => _openCamera('out'),
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
    required Color borderColor,
    required String iconPath,
    required VoidCallback onTap,
  }) {
    return ScaleTap(
      onTap: onTap,
      scale: 0.94,
      child: Container(
        height: 90,
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            // Soft atmospheric shadow
            BoxShadow(
              color: shadowColor.withOpacity(0.3),
              blurRadius: 10,
              offset: const Offset(0, 6),
            ),
            // Solid 3D bevel shadow
            BoxShadow(
              color: shadowColor.withOpacity(0.7),
              blurRadius: 0,
              offset: const Offset(0, 3),
            ),
          ],
          border: Border.all(color: borderColor.withOpacity(0.55), width: 1.2),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IgnorePointer(
              child: iconPath.endsWith('.svg')
                  ? FSvgPicture.asset(
                      iconPath,
                      width: 48,
                      height: 48,
                    )
                  : Image.asset(
                      iconPath,
                      width: 48,
                      height: 48,
                    ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  // ── Greeting Section ───────────────────────────────────────────────────────
  // ── Shift & Today's Attendance Card ───────────────────────────────────────
  Widget _buildShiftStatusCard() {
    final isCheckIn = _todayAttendance != null && _todayAttendance!['check_in'] != null;
    final isCheckOut = _todayAttendance != null && _todayAttendance!['check_out'] != null;
    final isLate = _todayAttendance != null && _todayAttendance!['status'] == 'late';
    
    final shiftStart = _workInfo?['start_time'] ?? '08:00';
    final shiftEnd = _workInfo?['end_time'] ?? '17:00';
    
    final inTime = _formatTime(_todayAttendance?['check_in']);
    final outTime = _formatTime(_todayAttendance?['check_out']);
    
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.cardShadow(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Shift header info
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primaryBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.work_history_rounded, color: AppColors.primary, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Shift Jadwal Kerja',
                      style: TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w700, letterSpacing: 0.2),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Shift Reguler ($shiftStart - $shiftEnd)',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.2),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _buildAttendanceBadge(isCheckIn, isCheckOut, isLate),
            ],
          ),
          const SizedBox(height: 16),
          
          // Unified Horizontal Attendance Times Panel
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFAFAF9),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.grey100, width: 1),
            ),
            child: Row(
              children: [
                // Check In
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: isCheckIn 
                              ? (isLate ? AppColors.warningBg : AppColors.successBg) 
                              : AppColors.grey50,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isCheckIn 
                              ? (isLate ? Icons.warning_amber_rounded : Icons.check_circle_rounded) 
                              : Icons.login_rounded,
                          color: isCheckIn 
                              ? (isLate ? AppColors.warning : AppColors.success) 
                              : AppColors.grey400,
                          size: 16,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Absen Masuk',
                              style: TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              inTime,
                              style: TextStyle(
                                fontSize: 16, 
                                fontWeight: FontWeight.w900, 
                                color: isCheckIn ? AppColors.success : AppColors.textPrimary.withOpacity(0.4),
                                letterSpacing: -0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Container(width: 1, height: 32, color: AppColors.grey200),
                const SizedBox(width: 12),
                // Check Out
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: isCheckOut 
                              ? AppColors.primaryBg 
                              : (isCheckIn ? AppColors.accentBg : AppColors.grey50),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isCheckOut 
                              ? Icons.check_circle_rounded 
                              : (isCheckIn ? Icons.logout_rounded : Icons.radio_button_unchecked),
                          color: isCheckOut 
                              ? AppColors.primary 
                              : (isCheckIn ? AppColors.accent : AppColors.grey400),
                          size: 16,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Absen Pulang',
                              style: TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              outTime,
                              style: TextStyle(
                                fontSize: 16, 
                                fontWeight: FontWeight.w900, 
                                color: isCheckOut 
                                    ? AppColors.primary 
                                    : (isCheckIn ? AppColors.accent : AppColors.textPrimary.withOpacity(0.4)),
                                letterSpacing: -0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Live GPS Status Area
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: _gpsStatus == 'in_range'
                  ? const Color(0xFFF0FDF4)
                  : (_gpsStatus == 'out_range' ? const Color(0xFFFFFBEB) : const Color(0xFFFEF2F2)),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Icon(
                  _gpsStatus == 'in_range'
                      ? Icons.gps_fixed_rounded
                      : (_gpsStatus == 'out_range' ? Icons.gps_not_fixed_rounded : Icons.location_off_rounded),
                  color: _gpsStatus == 'in_range'
                      ? AppColors.success
                      : (_gpsStatus == 'out_range' ? AppColors.warning : AppColors.danger),
                  size: 13,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _gpsMessage,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: _gpsStatus == 'in_range'
                          ? AppColors.success
                          : (_gpsStatus == 'out_range' ? AppColors.warning : AppColors.danger),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),

          if (isCheckIn && _todayAttendance?['location_name'] != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.location_on_rounded, color: AppColors.danger, size: 13),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Absen masuk di: ${_todayAttendance!['location_name']}',
                    style: const TextStyle(fontSize: 10, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAttendanceBadge(bool isCheckIn, bool isCheckOut, bool isLate) {
    String label = 'Belum Hadir';
    Color bgColor = AppColors.grey100;
    Color textColor = AppColors.textSecondary;
    
    if (isCheckOut) {
      label = 'Sudah Pulang';
      bgColor = AppColors.primaryBg;
      textColor = AppColors.primary;
    } else if (isCheckIn) {
      if (isLate) {
        label = 'Terlambat';
        bgColor = AppColors.warningBg;
        textColor = AppColors.warning;
      } else {
        label = 'Hadir';
        bgColor = AppColors.successBg;
        textColor = AppColors.success;
      }
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: textColor),
      ),
    );
  }

  // ── 8-Item Grid Menu ───────────────────────────────────────────────────────
  Widget _buildGridMenu() {
    final context = this.context;
    final List<Map<String, dynamic>> items = [
      {
        'label': 'Izin\nTerlambat',
        'iconPath': 'assets/images/01_izin_terlambat.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const RequestFormScreen(requestType: RequestType.latePermission)),
        ),
      },
      {
        'label': 'Izin Pulang\nCepat',
        'iconPath': 'assets/images/02_izin_pulang_cepat.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const RequestFormScreen(requestType: RequestType.earlyLeave)),
        ),
      },
      {
        'label': 'Ajukan\nCuti',
        'iconPath': 'assets/images/03_ajukan_cuti.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const RequestFormScreen(requestType: RequestType.leaveAnnual)),
        ),
      },
      {
        'label': 'Izin\nSakit',
        'iconPath': 'assets/images/04_izin_sakit.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const RequestFormScreen(requestType: RequestType.sick)),
        ),
      },
      {
        'label': 'Dinas Luar/\nKelilingan',
        'iconPath': 'assets/images/05_dinas_luar.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const RequestFormScreen(requestType: RequestType.dinas)),
        ),
      },
      {
        'label': 'Izin Keluar\nKantor',
        'iconPath': 'assets/images/06_izin_keluar_kantor.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const RequestFormScreen(requestType: RequestType.leaveOffice)),
        ),
      },
      {
        'label': 'Ajukan\nLembur',
        'iconPath': 'assets/images/07_ajukan_lembur.svg',
        'onTap': () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const RequestFormScreen(requestType: RequestType.overtime)),
        ),
      },
      {
        'label': 'Statistik\nUser',
        'iconPath': 'assets/images/08_statistik_user.svg',
        'onTap': () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const MyStatsScreen()),
          );
        },
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
                  child: FSvgPicture.asset(
                    item['iconPath'] as String,
                    width: 58,
                    height: 66,
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

  // ── Monthly Recap Stats Summary ──────────────────────────────────────────
  Widget _buildStatsSummary() {
    final now = DateTime.now();
    final monthName = DateFormat('MMMM', 'id_ID').format(now);
    
    final totalDays = _presentCount + _lateCount + _leaveSickCount;
    final double attendanceRate = totalDays > 0 ? (_presentCount + _lateCount) / totalDays : 1.0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.grey200),
        boxShadow: AppColors.cardShadow(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4, height: 18,
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
              Text(
                'Analisis Kehadiran Bulanan ($monthName)',
                style: const TextStyle(
                  fontSize: 14.5, 
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
                width: 80,
                height: 80,
                margin: const EdgeInsets.only(right: 12),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 76,
                      height: 76,
                      child: CircularProgressIndicator(
                        value: attendanceRate,
                        strokeWidth: 6.5,
                        backgroundColor: AppColors.grey200,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          attendanceRate >= 0.90
                              ? AppColors.success
                              : (attendanceRate >= 0.75
                                  ? AppColors.warning
                                  : AppColors.danger),
                        ),
                      ),
                    ),
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '${(attendanceRate * 100).toStringAsFixed(0)}%',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: attendanceRate >= 0.90
                                ? AppColors.success
                                : (attendanceRate >= 0.75
                                    ? AppColors.warning
                                    : AppColors.danger),
                            letterSpacing: -0.5,
                            height: 1.1,
                          ),
                        ),
                        const Text(
                          'Rasio',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Mini Stat Cards
              Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: _buildMiniStatCard(
                        icon: Icons.check_circle_rounded,
                        color: AppColors.success,
                        bgColor: AppColors.successBg,
                        value: '$_presentCount',
                        label: 'Hadir',
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _buildMiniStatCard(
                        icon: Icons.warning_rounded,
                        color: AppColors.warning,
                        bgColor: AppColors.warningBg,
                        value: '$_lateCount',
                        label: 'Terlambat',
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _buildMiniStatCard(
                        icon: Icons.assignment_turned_in_rounded,
                        color: AppColors.info,
                        bgColor: AppColors.infoBg,
                        value: '$_leaveSickCount',
                        label: 'Izin/Sakit',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStatCard({
    required IconData icon,
    required Color color,
    required Color bgColor,
    required String value,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.grey200),
        boxShadow: AppColors.cardShadow(),
        gradient: LinearGradient(
          colors: [Colors.white, bgColor.withOpacity(0.12)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: bgColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.12),
                  blurRadius: 6,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: Icon(icon, color: color, size: 15),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 20, 
              fontWeight: FontWeight.w900, 
              color: color,
              letterSpacing: -0.5,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 9.5, 
              color: AppColors.textSecondary, 
              fontWeight: FontWeight.w700,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }

  // ── Quota Card ─────────────────────────────────────────────────────────────
  Widget _buildQuotaCard() {
    final total = (_quota?['total_days'] as num?)?.toDouble() ?? 0.0;
    final used = (_quota?['used_days'] as num?)?.toDouble() ?? 0.0;
    final remaining = (_quota?['remaining_days'] as num?)?.toDouble() ?? 0.0;
    final progress = total > 0 ? used / total : 0.0;

    return Container(
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.grey200),
        boxShadow: AppColors.cardShadow(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4, height: 16,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Alokasi & Sisa Cuti Tahunan',
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              Column(
                children: [
                  Text(
                    '${total.toInt()}',
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  const Text('Total Kuota', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w500)),
                ],
              ),
              Container(width: 1, height: 28, color: AppColors.grey200),
              Column(
                children: [
                  Text(
                    '${used.toInt()}',
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  const Text('Terpakai', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w500)),
                ],
              ),
              Container(width: 1, height: 28, color: AppColors.grey200),
              Column(
                children: [
                  Text(
                    '${remaining.toInt()}',
                    style: const TextStyle(color: AppColors.primary, fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  const Text('Sisa Cuti', style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Stack(
              children: [
                Container(height: 8, width: double.infinity, color: AppColors.grey100),
                FractionallySizedBox(
                  widthFactor: progress.clamp(0.0, 1.0),
                  child: Container(
                    height: 8,
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Terpakai ${used.toInt()} dari ${total.toInt()} hari',
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
              ),
              Text(
                '${(progress * 100).toInt()}%',
                style: const TextStyle(fontSize: 11, color: AppColors.textPrimary, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Announcements Section ──────────────────────────────────────────────────
  Widget _buildAnnouncementsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 4, height: 16,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'Pengumuman Perusahaan',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 145,
          child: PageView.builder(
            controller: PageController(viewportFraction: 0.92),
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
                margin: const EdgeInsets.only(right: 12, bottom: 8),
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
                                      const SizedBox(width: 10),
                                      Text(
                                        ann['date'] as String,
                                        style: const TextStyle(color: AppColors.textMuted, fontSize: 10.5, fontWeight: FontWeight.w500),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    ann['title'] as String,
                                    style: const TextStyle(
                                      color: AppColors.textPrimary, 
                                      fontSize: 14, 
                                      fontWeight: FontWeight.w800, 
                                      letterSpacing: -0.2
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    ann['desc'] as String,
                                    style: const TextStyle(
                                      color: AppColors.textSecondary, 
                                      fontSize: 11, 
                                      height: 1.4
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
                                size: 24
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
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            _announcements.length,
            (index) => AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              height: 5,
              width: _activeAnnouncementIndex == index ? 14 : 5,
              decoration: BoxDecoration(
                color: _activeAnnouncementIndex == index ? AppColors.primary : AppColors.grey300,
                borderRadius: BorderRadius.circular(3.5),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildStatusBadge(String? status) {
    final s = (status ?? '').toLowerCase();
    String text = 'Diproses';
    Color textColor = AppColors.textSecondary;
    Color bgColor = AppColors.grey100;
    if (s == 'approved') {
      text = 'Disetujui';
      textColor = AppColors.success;
      bgColor = AppColors.successBg;
    } else if (s == 'pending') {
      text = 'Menunggu';
      textColor = AppColors.warning;
      bgColor = AppColors.warningBg;
    } else if (s == 'rejected') {
      text = 'Ditolak';
      textColor = AppColors.danger;
      bgColor = AppColors.dangerBg;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontSize: 10.5,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildRequestItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String? status,
  }) {
    String displayTitle = title;
    if (title.isNotEmpty) {
      displayTitle = title[0].toUpperCase() + title.substring(1);
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey100, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.01),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayTitle,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          StatusBadge(status: status ?? 'pending', compact: true),
        ],
      ),
    );
  }

  /// Widget displaying recent leave and overtime requests
  Widget _buildRecentRequestsSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.grey200),
        boxShadow: AppColors.cardShadow(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4, height: 16,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Status Permohonan Terbaru',
                style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_recentLeaves.isEmpty && _overtimeList.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBg.withOpacity(0.4),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.history_rounded,
                      color: AppColors.primary,
                      size: 24,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Belum Ada Permohonan Terbaru',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Riwayat permohonan cuti atau lembur Anda akan muncul di sini.',
                    style: TextStyle(
                      fontSize: 10.5,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          // Recent Leaves
          if (_recentLeaves.isNotEmpty) ...[
            ..._recentLeaves.map((l) => _buildRequestItem(
              icon: Icons.event_available_rounded,
              iconColor: const Color(0xFF5C6BC0),
              title: l['type'] ?? 'Cuti',
              subtitle: 'Pengajuan Cuti',
              status: l['status'],
            )),
          ],
          // Recent Overtime
          if (_overtimeList.isNotEmpty) ...[
            if (_recentLeaves.isNotEmpty) const SizedBox(height: 12),
            ..._overtimeList.map((o) => _buildRequestItem(
              icon: Icons.more_time_rounded,
              iconColor: const Color(0xFF0D9488),
              title: '${o['duration'] ?? o['duration_minutes'] ?? 0} Menit',
              subtitle: 'Kerja Lembur',
              status: o['status'],
            )),
          ],
        ],
      ),
    );
  }

  /// Helpdesk banner that opens WhatsApp chat
  Widget _buildHelpdeskBanner() {
    return GestureDetector(
      onTap: _openWhatsApp,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        margin: const EdgeInsets.only(bottom: 24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.grey200),
          boxShadow: AppColors.cardShadow(),
          gradient: LinearGradient(
            colors: [Colors.white, const Color(0xFF25D366).withOpacity(0.03)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF25D366).withOpacity(0.08),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF25D366).withOpacity(0.1),
                    blurRadius: 8,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: const Icon(Icons.support_agent_rounded, color: Color(0xFF128C7E), size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Pusat Bantuan & Hubungan Karyawan',
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 13.5, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 3),
                  const Text(
                    'Hubungi tim HRD untuk konsultasi administrasi & operasional',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 10.5, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.grey50,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.grey100, width: 1),
              ),
              child: const Icon(Icons.arrow_forward_ios, color: AppColors.textSecondary, size: 12),
            ),
          ],
        ),
      ),
    );
  }
}
class _QuotaItem extends StatelessWidget {
  final String value, label;
  const _QuotaItem({required this.value, required this.label});

  @override
  Widget build(BuildContext context) => Column(children: [
    Text(value, style: const TextStyle(color: Colors.black87, fontSize: 18, fontWeight: FontWeight.w800)),
    const SizedBox(height: 2),
    Text(label, style: const TextStyle(color: Colors.black54, fontSize: 11)),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM WIDGETS & PAINTERS FOR GLOSSY 3D EFFECTS
// ─────────────────────────────────────────────────────────────────────────────

class Glossy3dIcon extends StatelessWidget {
  final List<Color> bgGradientColors;
  final Widget child;
  final Color shadowColor;

  const Glossy3dIcon({
    super.key,
    required this.bgGradientColors,
    required this.child,
    required this.shadowColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: bgGradientColors,
          center: const Alignment(-0.3, -0.3),
          radius: 0.85,
        ),
        boxShadow: [
          // Ambient bottom shadow
          BoxShadow(
            color: shadowColor.withOpacity(0.35),
            blurRadius: 10,
            spreadRadius: 1,
            offset: const Offset(0, 5),
          ),
          // Light top-left reflection shadow for claymorphic depth
          BoxShadow(
            color: Colors.white.withOpacity(0.4),
            blurRadius: 6,
            spreadRadius: -1,
            offset: const Offset(-3, -3),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Glossy overlay (diagonal shiny highlight)
          Positioned(
            top: 2,
            left: 6,
            right: 6,
            child: Container(
              height: 24,
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.all(Radius.elliptical(25, 12)),
                gradient: LinearGradient(
                  colors: [
                    Colors.white.withOpacity(0.45),
                    Colors.white.withOpacity(0.0),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),
          // Inner badge
          child,
        ],
      ),
    );
  }
}
