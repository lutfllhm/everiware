import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../services/realtime_service.dart';


class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});
  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  late DateTime _currentMonth;
  List<AttendanceModel> _attendances = [];
  List<HolidayModel> _holidays = [];
  bool _loading = true;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);
    _loadData();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'attendance_update') {
        _loadData();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService().getMyAttendance(
          month: _currentMonth.month,
          year: _currentMonth.year,
        ),
        ApiService().getHolidays(year: _currentMonth.year),
      ]);
      if (mounted) {
        setState(() {
          _attendances = (results[0]['attendances'] as List? ?? [])
              .map((a) => AttendanceModel.fromJson(a))
              .toList();
          _holidays = (results[1]['holidays'] as List? ?? [])
              .map((h) => HolidayModel.fromJson(h))
              .toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _prevMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
    _loadData();
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
    _loadData();
  }

  AttendanceModel? _attendanceOnDate(DateTime date) {
    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    try {
      return _attendances.firstWhere((a) => a.date == dateStr);
    } catch (_) {
      return null;
    }
  }

  HolidayModel? _getHoliday(DateTime day) {
    final dateStr = DateFormat('yyyy-MM-dd').format(day);
    try {
      return _holidays.firstWhere((h) => h.date.startsWith(dateStr));
    } catch (_) {
      return null;
    }
  }

  List<Color> _indicatorsFor(String status) {
    switch (status) {
      case 'present':
        return [const Color(0xFF22C55E)];
      case 'late':
        return [const Color(0xFF22C55E), const Color(0xFFEF4444)];
      case 'late_permit':
        return [const Color(0xFF22C55E), const Color(0xFF14B8A6)];
      case 'early_leave':
        return [const Color(0xFF22C55E), const Color(0xFFF97316)];
      case 'leave':
      case 'absent':
        return [const Color(0xFF60A5FA)];
      case 'sick':
        return [const Color(0xFFA855F7)];
      default:
        return [];
    }
  }

  // ── Status Color Mapping ─────────────────────────────────────────────────
  static const _statusColors = <String, Color>{
    'present':     Color(0xFF22C55E), // Hijau — Hadir/Tepat Waktu
    'late':        Color(0xFFEF4444), // Merah — Terlambat
    'late_permit': Color(0xFF14B8A6), // Toska/Teal — Izin Datang Terlambat
    'early_leave': Color(0xFFF97316), // Oranye — Izin Pulang Cepat
    'leave':       Color(0xFF60A5FA), // Biru Muda — Cuti
    'absent':      Color(0xFF60A5FA), // Biru Muda — Tidak Masuk
    'sick':        Color(0xFFA855F7), // Ungu — Izin Sakit
  };

  static const _statusLabels = <String, String>{
    'present':     'Hadir/Tepat Waktu',
    'late':        'Terlambat',
    'late_permit': 'Izin Datang Terlambat',
    'early_leave': 'Izin Pulang Cepat',
    'leave':       'Cuti',
    'absent':      'Tidak Masuk',
    'sick':        'Izin Sakit',
  };

  Color? _colorFor(String status) => _statusColors[status];
  String _labelFor(String status) => _statusLabels[status] ?? status;

  // ── Summary counts ───────────────────────────────────────────────────────
  int get _present     => _attendances.where((a) => a.status == 'present').length;
  int get _late        => _attendances.where((a) => a.status == 'late').length;
  int get _latePermit  => _attendances.where((a) => a.status == 'late_permit').length;
  int get _earlyLeave  => _attendances.where((a) => a.status == 'early_leave').length;
  int get _leave       => _attendances.where((a) => a.status == 'leave').length;
  int get _absent      => _attendances.where((a) => a.status == 'absent').length;
  int get _sick        => _attendances.where((a) => a.status == 'sick').length;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final daysInMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    final firstWeekday = DateTime(_currentMonth.year, _currentMonth.month, 1).weekday % 7;
    final monthLabel = DateFormat('MMMM yyyy', 'id_ID').format(_currentMonth);
    final isCurrentMonth = _currentMonth.month == now.month && _currentMonth.year == now.year;
    final user = context.watch<AuthProvider>().user;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 100),
          children: [
            // ── Hero Header ─────────────────────────────────────────────
            ProfileHeader(
              title: 'Kalender Kehadiran',
              name: user?.name ?? '',
              position: user?.position ?? user?.roleLabel ?? '',
              department: user?.department ?? '',
              avatarFilename: user?.avatar,
            ),

              // ── Loading State ───────────────────────────────────────────
              if (_loading)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  child: Column(
                    children: List.generate(
                      3,
                      (_) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ShimmerBox(
                            width: double.infinity, height: 90, radius: 16),
                      ),
                    ),
                  ),
                )
              else ...[
                // ── Calendar Card ───────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border),
                      boxShadow: AppColors.cardShadow(),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Premium Header
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                          child: Row(
                            children: [
                              Container(
                                decoration: BoxDecoration(
                                  color: AppColors.grey50,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: IconButton(
                                  icon: const Icon(Icons.chevron_left_rounded, color: AppColors.textPrimary, size: 20),
                                  onPressed: _prevMonth,
                                  visualDensity: VisualDensity.compact,
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  monthLabel,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              Container(
                                decoration: BoxDecoration(
                                  color: AppColors.grey50,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: IconButton(
                                  icon: const Icon(Icons.chevron_right_rounded, color: AppColors.textPrimary, size: 20),
                                  onPressed: _nextMonth,
                                  visualDensity: VisualDensity.compact,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Divider(height: 1, color: AppColors.border),
                        // Weekday Headers & Grid with Clean Background
                        Container(
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.vertical(bottom: Radius.circular(18)),
                          ),
                          child: Column(
                            children: [
                              const SizedBox(height: 14),
                              // Weekday Headers
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                child: Row(
                                  children: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
                                      .map((d) => Expanded(
                                            child: Center(
                                              child: Text(
                                                d.toUpperCase(),
                                                style: const TextStyle(
                                                  fontSize: 10.5,
                                                  fontWeight: FontWeight.w800,
                                                  color: AppColors.textMuted,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                            ),
                                          ))
                                      .toList(),
                                ),
                              ),
                              const SizedBox(height: 10),
                              // Calendar Grid
                              Padding(
                                padding: const EdgeInsets.fromLTRB(10, 0, 10, 12),
                                child: Column(
                                  children: _buildCalendarWeeks(
                                      daysInMonth, firstWeekday, now, isCurrentMonth),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // ── Legend + Summary unified ────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: _buildLegendAndSummaryCard(),
                ),

                // ── Syarat Absensi ──────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: _buildRequirementsCard(),
                ),
              ],
            ],
          ),
        ),
      );
    }

  // ── Calendar Grid ──────────────────────────────────────────────────────────
  List<Widget> _buildCalendarWeeks(
      int daysInMonth, int firstWeekday, DateTime now, bool isCurrentMonth) {
    final today = now.day;
    final weeks = <Widget>[];
    final totalCells = firstWeekday + daysInMonth;
    final numWeeks = (totalCells / 7).ceil();

    int day = 1;
    for (int w = 0; w < numWeeks; w++) {
      final cells = <Widget>[];
      for (int d = 0; d < 7; d++) {
        final cellIdx = w * 7 + d;
        if (cellIdx < firstWeekday || day > daysInMonth) {
          cells.add(
            Expanded(
              child: Container(
                height: 48,
                margin: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  color: Colors.transparent,
                ),
              ),
            ),
          );
        } else {
          final currentDay = day;
          final dayDate =
              DateTime(_currentMonth.year, _currentMonth.month, currentDay);
          final att = _attendanceOnDate(dayDate);
          final isToday = isCurrentMonth && currentDay == today;
          
          final holiday = _getHoliday(dayDate);
          final isSun = d == 0;
          final isHoliday = holiday != null;
          
          Color dateTextColor = AppColors.textPrimary;
          if (isSun || isHoliday) {
            dateTextColor = const Color(0xFFEF4444); // Red color for Sunday and Holidays
          }

          cells.add(
            Expanded(
              child: GestureDetector(
                onTap: att != null
                    ? () => _showDetail(context, att, dayDate)
                    : null,
                child: Container(
                  height: 48,
                  margin: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: isToday ? AppColors.primaryBg.withValues(alpha: 0.5) : AppColors.grey50,
                    borderRadius: BorderRadius.circular(10),
                    border: isToday
                        ? Border.all(
                            color: AppColors.primary,
                            width: 1.5,
                          )
                        : Border.all(
                            color: AppColors.border.withValues(alpha: 0.5),
                            width: 0.8,
                          ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$currentDay',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isToday || att != null || isHoliday
                              ? FontWeight.bold
                              : FontWeight.w600,
                          color: dateTextColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      if (att != null)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: _indicatorsFor(att.status).map((color) => Container(
                            margin: const EdgeInsets.symmetric(horizontal: 1.5),
                            width: 12,
                            height: 4,
                            decoration: BoxDecoration(
                              color: color,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          )).toList(),
                        )
                      else
                        const SizedBox(height: 4),
                    ],
                  ),
                ),
              ),
            ),
          );
          day++;
        }
      }
      weeks.add(Padding(
        padding: const EdgeInsets.symmetric(vertical: 2.0),
        child: Row(children: cells),
      ));
    }
    return weeks;
  }

  // ── Legend + Summary unified ───────────────────────────────────────────────
  Widget _buildLegendAndSummaryCard() {
    return Column(
      children: [
        _buildLegend(),
        const SizedBox(height: 12),
        _buildSummaryCard(),
      ],
    );
  }

  // ── Legend ─────────────────────────────────────────────────────────────────
  Widget _buildLegend() {
    final legendItems = [
      _LegendItem(color: const Color(0xFF22C55E), label: 'Hadir/Tepat Waktu'),
      _LegendItem(color: const Color(0xFFF97316), label: 'Izin Pulang Cepat'),
      _LegendItem(color: const Color(0xFFEF4444), label: 'Terlambat'),
      _LegendItem(color: const Color(0xFF60A5FA), label: 'Tidak Masuk/Cuti'),
      _LegendItem(color: const Color(0xFF14B8A6), label: 'Izin Datang Terlambat'),
      _LegendItem(color: const Color(0xFFA855F7), label: 'Izin Sakit'),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow(),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _buildLegendRowItem(legendItems[0])),
              Expanded(child: _buildLegendRowItem(legendItems[1])),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _buildLegendRowItem(legendItems[2])),
              Expanded(child: _buildLegendRowItem(legendItems[3])),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _buildLegendRowItem(legendItems[4])),
              Expanded(child: _buildLegendRowItem(legendItems[5])),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLegendRowItem(_LegendItem item) {
    return Row(
      children: [
        Container(
          width: 14,
          height: 4,
          decoration: BoxDecoration(
            color: item.color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            item.label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }

  // ── Summary Card ───────────────────────────────────────────────────────────
  Widget _buildSummaryCard() {
    final statList = [
      _StatItem(
        label: 'Hadir/Tepat Waktu',
        count: _present,
        color: const Color(0xFF22C55E),
      ),
      _StatItem(
        label: 'Terlambat',
        count: _late,
        color: const Color(0xFFEF4444),
      ),
      _StatItem(
        label: 'Izin Datang Terlambat',
        count: _latePermit,
        color: const Color(0xFF14B8A6),
      ),
      _StatItem(
        label: 'Izin Pulang Cepat',
        count: _earlyLeave,
        color: const Color(0xFFF97316),
      ),
      _StatItem(
        label: 'Tidak Masuk/Cuti',
        count: _leave + _absent,
        color: const Color(0xFF60A5FA),
      ),
      _StatItem(
        label: 'Izin Sakit',
        count: _sick,
        color: const Color(0xFFA855F7),
      ),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.primaryBg.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primaryBorder),
        boxShadow: AppColors.cardShadow(),
      ),
      child: Column(
        children: [
          // Row 1
          Row(
            children: [
              Expanded(child: _buildSummaryItem(statList[0])),
              _buildVerticalDivider(),
              Expanded(child: _buildSummaryItem(statList[1])),
              _buildVerticalDivider(),
              Expanded(child: _buildSummaryItem(statList[2])),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12, horizontal: 8),
            child: Divider(color: AppColors.primaryBorder, height: 1),
          ),
          // Row 2
          Row(
            children: [
              Expanded(child: _buildSummaryItem(statList[3])),
              _buildVerticalDivider(),
              Expanded(child: _buildSummaryItem(statList[4])),
              _buildVerticalDivider(),
              Expanded(child: _buildSummaryItem(statList[5])),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalDivider() {
    return Container(
      width: 1,
      height: 40,
      color: AppColors.primaryBorder.withValues(alpha: 0.5),
    );
  }

  Widget _buildSummaryItem(_StatItem item) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          '${item.count}',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: item.color,
          ),
        ),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            item.label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }

  // ── Requirements Card ──────────────────────────────────────────────────────
  Widget _buildRequirementsCard() {
    final reqs = [
      'Harus berada di area lokasi kerja yang ditentukan',
      'Wajib selfie foto saat absensi',
      'Wajah harus cocok dengan foto profil akun kamu',
      'Pastikan GPS aktif di perangkat kamu',
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 16),
              ),
              const SizedBox(width: 10),
              const Text(
                'Syarat Absensi',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Column(
            children: reqs.map((req) => Padding(
              padding: const EdgeInsets.only(bottom: 10.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 6.0, left: 4.0, right: 10.0),
                    child: Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      req,
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            )).toList(),
          ),
        ],
      ),
    );
  }

  // ── Detail Bottom Sheet ────────────────────────────────────────────────────
  void _showDetail(
      BuildContext context, AttendanceModel att, DateTime date) {
    final color = _colorFor(att.status) ?? AppColors.primary;
    final label = _labelFor(att.status);
    final timeIn = att.checkIn != null
        ? DateFormat('HH:mm').format(att.checkIn!)
        : '-';
    final timeOut = att.checkOut != null
        ? DateFormat('HH:mm').format(att.checkOut!)
        : '-';
    final locName = att.locationName ?? '-';

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Date & Status
              Row(
                children: [
                  Expanded(
                    child: Text(
                      DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(date),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          label,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                            color: color,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Check In / Check Out
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.grey50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    // Check In
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.login_rounded,
                                  size: 14, color: AppColors.success),
                              const SizedBox(width: 4),
                              const Text('Masuk',
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textMuted)),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            timeIn,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: timeIn != '-'
                                  ? AppColors.textPrimary
                                  : AppColors.textMuted,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      height: 30,
                      width: 1,
                      color: AppColors.border,
                    ),
                    // Check Out
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              const Text('Pulang',
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textMuted)),
                              const SizedBox(width: 4),
                              Icon(Icons.logout_rounded,
                                  size: 14, color: AppColors.danger),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            timeOut,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: timeOut != '-'
                                  ? AppColors.textPrimary
                                  : AppColors.textMuted,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Location
              Row(
                children: [
                  Icon(Icons.location_on_rounded,
                      size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      locName,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Supporting Classes ────────────────────────────────────────────────────────
class _StatItem {
  final String label;
  final int count;
  final Color color;
  const _StatItem({
    required this.label,
    required this.count,
    required this.color,
  });
}

class _LegendItem {
  final Color color;
  final String label;
  const _LegendItem({required this.color, required this.label});
}