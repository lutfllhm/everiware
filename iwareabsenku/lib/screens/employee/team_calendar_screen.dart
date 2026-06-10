import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';

class TeamCalendarScreen extends StatefulWidget {
  const TeamCalendarScreen({super.key});
  @override
  State<TeamCalendarScreen> createState() => _TeamCalendarScreenState();
}

class _TeamCalendarScreenState extends State<TeamCalendarScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  // Data
  List<dynamic> _onLeave  = [];
  List<dynamic> _todayAtt = [];
  List<dynamic> _notYet   = [];
  List<HolidayModel> _holidays = [];
  bool _loading = true;

  // Kalender bulanan
  DateTime _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);

  // Popup hari yang dipilih
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService().getTeamCalendar(),
        ApiService().getHolidays(year: _currentMonth.year),
      ]);
      if (mounted) {
        setState(() {
          _onLeave  = results[0]['onLeave']        as List? ?? [];
          _todayAtt = results[0]['todayAttendance'] as List? ?? [];
          _notYet   = results[0]['notYetCheckedIn'] as List? ?? [];
          _holidays = (results[1]['holidays'] as List? ?? [])
              .map((h) => HolidayModel.fromJson(h))
              .toList();
          _loading  = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // Cek apakah tanggal adalah hari libur
  HolidayModel? _getHoliday(DateTime day) {
    final dateStr = DateFormat('yyyy-MM-dd').format(day);
    try {
      return _holidays.firstWhere((h) => h.date.startsWith(dateStr));
    } catch (_) {
      return null;
    }
  }

  // Karyawan yang cuti pada hari tertentu
  List<dynamic> _getLeavesOnDay(DateTime day) {
    return _onLeave.where((l) {
      final start = DateTime.parse(l['start_date'] as String);
      final end   = DateTime.parse(l['end_date']   as String);
      return !day.isBefore(start) && !day.isAfter(end);
    }).toList();
  }

  // Bangun grid kalender
  List<DateTime?> _buildCalendarDays() {
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final lastDay  = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
    // Minggu = 7 (ISO), kita pakai 0=Min, 1=Sen, ..., 6=Sab
    final startWeekday = firstDay.weekday % 7; // 0=Min
    final days = <DateTime?>[];
    for (int i = 0; i < startWeekday; i++) days.add(null);
    for (int d = 1; d <= lastDay.day; d++) {
      days.add(DateTime(_currentMonth.year, _currentMonth.month, d));
    }
    // Pad akhir agar genap 7 kolom
    while (days.length % 7 != 0) days.add(null);
    return days;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kalender Tim'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadData,
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Kalender'),
            Tab(text: 'Izin/Cuti'),
            Tab(text: 'Hari Ini'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _buildCalendarTab(),
                _buildLeaveTab(),
                _buildTodayTab(),
              ],
            ),
    );
  }

  // ── TAB 1: KALENDER BULANAN ───────────────────────────────────────────────
  Widget _buildCalendarTab() {
    final calDays = _buildCalendarDays();
    final today   = DateTime.now();
    final todayStr = DateFormat('yyyy-MM-dd').format(today);

    return Column(children: [
      // Navigasi bulan
      Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(children: [
          IconButton(
            icon: const Icon(Icons.chevron_left_rounded),
            onPressed: () => setState(() {
              _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
              _loadData();
            }),
          ),
          Expanded(
            child: Text(
              DateFormat('MMMM yyyy', 'id_ID').format(_currentMonth),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                  color: AppColors.textPrimary),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right_rounded),
            onPressed: () => setState(() {
              _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
              _loadData();
            }),
          ),
        ]),
      ),

      // Header hari
      Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          children: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
              .asMap()
              .entries
              .map((e) => Expanded(
                    child: Text(
                      e.value,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: e.key == 0
                            ? AppColors.danger
                            : e.key == 6
                                ? AppColors.amber
                                : AppColors.textMuted,
                      ),
                    ),
                  ))
              .toList(),
        ),
      ),
      const Divider(height: 1, color: AppColors.divider),

      // Grid kalender
      Expanded(
        child: SingleChildScrollView(
          child: Column(children: [
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.all(4),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                childAspectRatio: 0.75,
              ),
              itemCount: calDays.length,
              itemBuilder: (_, i) {
                final day = calDays[i];
                if (day == null) return const SizedBox();

                final dateStr  = DateFormat('yyyy-MM-dd').format(day);
                final isToday  = dateStr == todayStr;
                final isSun    = day.weekday == 7;
                final isSat    = day.weekday == 6;
                final holiday  = _getHoliday(day);
                final leaves   = _getLeavesOnDay(day);
                final isSelected = _selectedDay != null &&
                    DateFormat('yyyy-MM-dd').format(_selectedDay!) == dateStr;

                return GestureDetector(
                  onTap: () => setState(() {
                    _selectedDay = isSelected ? null : day;
                  }),
                  child: Container(
                    margin: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: isToday
                          ? AppColors.primary
                          : isSelected
                              ? AppColors.primaryBg
                              : holiday != null
                                  ? const Color(0xFFFFF8E1)
                                  : isSun
                                      ? const Color(0xFFFFF5F5)
                                      : isSat
                                          ? const Color(0xFFFFFBF0)
                                          : Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : isToday
                                ? AppColors.primary
                                : AppColors.divider,
                        width: isSelected || isToday ? 1.5 : 0.5,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        // Nomor tanggal
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: isToday ? Colors.white : Colors.transparent,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              '${day.day}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: isToday
                                    ? AppColors.primary
                                    : isSun
                                        ? AppColors.danger
                                        : isSat
                                            ? AppColors.amber
                                            : holiday != null
                                                ? AppColors.amber
                                                : AppColors.textPrimary,
                              ),
                            ),
                          ),
                        ),
                        // Dot hari libur
                        if (holiday != null) ...[
                          const SizedBox(height: 2),
                          Container(
                            width: 4, height: 4,
                            decoration: const BoxDecoration(
                              color: AppColors.danger,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                        // Chip karyawan cuti (max 2)
                        if (leaves.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          ...leaves.take(2).map((l) => Container(
                                margin: const EdgeInsets.symmetric(
                                    horizontal: 2, vertical: 1),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 3, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  (l['name'] as String? ?? '?')
                                      .split(' ')
                                      .first,
                                  style: const TextStyle(
                                    fontSize: 7,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              )),
                          if (leaves.length > 2)
                            Text(
                              '+${leaves.length - 2}',
                              style: const TextStyle(
                                  fontSize: 7, color: AppColors.textMuted),
                            ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),

            // Detail hari yang dipilih
            if (_selectedDay != null) ...[
              const Divider(height: 1, color: AppColors.divider),
              _buildDayDetail(_selectedDay!),
            ],

            // Legend
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Wrap(spacing: 12, runSpacing: 8, children: [
                _LegendItem(color: AppColors.danger, label: 'Hari Libur'),
                _LegendItem(color: AppColors.amber, label: 'Sabtu'),
                _LegendItem(color: AppColors.primary, label: 'Izin/Cuti'),
              ]),
            ),
          ]),
        ),
      ),
    ]);
  }

  Widget _buildDayDetail(DateTime day) {
    final holiday = _getHoliday(day);
    final leaves  = _getLeavesOnDay(day);
    final isSat   = day.weekday == 6;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      color: AppColors.surface,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
          DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(day),
          style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: AppColors.textPrimary),
        ),
        const SizedBox(height: 8),
        if (holiday != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.amber100),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.celebration_rounded,
                  size: 14, color: AppColors.amber),
              const SizedBox(width: 6),
              Text(holiday.name,
                  style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.amber,
                      fontWeight: FontWeight.w600)),
            ]),
          ),
        if (isSat && holiday == null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBF0),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.amber100),
            ),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.wb_sunny_outlined, size: 14, color: AppColors.amber),
              SizedBox(width: 6),
              Text('Sabtu - Setengah Hari',
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.amber,
                      fontWeight: FontWeight.w600)),
            ]),
          ),
        if (leaves.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text('Tidak ada karyawan izin/cuti',
                style: TextStyle(
                    fontSize: 12, color: AppColors.textMuted)),
          )
        else ...[
          const SizedBox(height: 8),
          Text('${leaves.length} karyawan izin/cuti:',
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: leaves.map((l) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.primaryBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.primaryBorder),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(
                  (l['name'] as String? ?? '?')[0].toUpperCase(),
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary),
                ),
                const SizedBox(width: 5),
                Text(
                  (l['name'] as String? ?? '-').split(' ').first,
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary),
                ),
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    l['type_label'] ?? l['type'] ?? '-',
                    style: const TextStyle(
                        fontSize: 9,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ]),
            )).toList(),
          ),
        ],
      ]),
    );
  }

  // ── TAB 2: DAFTAR IZIN/CUTI ───────────────────────────────────────────────
  Widget _buildLeaveTab() {
    if (_onLeave.isEmpty) {
      return const EmptyState(
        icon: Icons.event_available_outlined,
        title: 'Tidak ada izin/cuti',
        subtitle: 'Tidak ada karyawan yang sedang\nizin atau cuti minggu ini',
      );
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        itemCount: _onLeave.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) {
          final l     = _onLeave[i] as Map<String, dynamic>;
          final start = DateTime.parse(l['start_date'] as String);
          final end   = DateTime.parse(l['end_date']   as String);
          return AppCard(
            child: Row(children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  gradient: AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    (l['name'] as String? ?? '?')[0].toUpperCase(),
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(l['name'] ?? '-',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(
                    [l['department'], l['position']]
                            .where((v) =>
                                v != null && v.toString().isNotEmpty)
                            .join(' - ')
                            .isEmpty
                        ? '-'
                        : [l['department'], l['position']]
                            .where((v) =>
                                v != null && v.toString().isNotEmpty)
                            .join(' - '),
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 6),
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                          color: AppColors.primaryBg,
                          borderRadius: BorderRadius.circular(8)),
                      child: Text(
                          l['type_label'] ?? l['type'] ?? '-',
                          style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${DateFormat('d MMM', 'id_ID').format(start)} - ${DateFormat('d MMM', 'id_ID').format(end)}',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.textMuted),
                    ),
                  ]),
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                    color: AppColors.grey100,
                    borderRadius: BorderRadius.circular(8)),
                child: Text('${l['total_days']} hari',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary)),
              ),
            ]),
          );
        },
      ),
    );
  }

  // ── TAB 3: STATUS HARI INI ────────────────────────────────────────────────
  Widget _buildTodayTab() {
    final present = _todayAtt
        .where((a) => ['present', 'late'].contains(a['status']))
        .length;
    final onLeaveToday = _onLeave.where((l) {
      final t = DateTime.now();
      final s = DateTime.parse(l['start_date'] as String);
      final e = DateTime.parse(l['end_date']   as String);
      return !s.isAfter(t) && !e.isBefore(t);
    }).length;

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          // Summary
          Row(children: [
            _StatCard(value: '$present',      label: 'Hadir',       color: AppColors.teal),
            const SizedBox(width: 10),
            _StatCard(value: '${_notYet.length}', label: 'Belum Absen', color: AppColors.amber),
            const SizedBox(width: 10),
            _StatCard(value: '$onLeaveToday', label: 'Izin/Cuti',   color: AppColors.sky),
          ]),
          const SizedBox(height: 20),

          if (_todayAtt.isNotEmpty) ...[
            const Text('Sudah Absen',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 10),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: _todayAtt.asMap().entries.map((e) {
                  final a      = e.value as Map<String, dynamic>;
                  final isLast = e.key == _todayAtt.length - 1;
                  return Column(children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      child: Row(children: [
                        Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                              color: AppColors.grey100,
                              borderRadius: BorderRadius.circular(10)),
                          child: Center(
                              child: Text(
                                  (a['name'] as String? ?? '?')[0],
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textSecondary))),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                            child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                          Text(a['name'] ?? '-',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                  color: AppColors.textPrimary)),
                          Text(
                            [a['department'], a['position']]
                                    .where((v) =>
                                        v != null &&
                                        v.toString().isNotEmpty)
                                    .join(' - ')
                                    .isEmpty
                                ? '-'
                                : [a['department'], a['position']]
                                    .where((v) =>
                                        v != null &&
                                        v.toString().isNotEmpty)
                                    .join(' - '),
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted),
                          ),
                        ])),
                        StatusBadge(status: a['status'] ?? 'present'),
                      ]),
                    ),
                    if (!isLast)
                      const Divider(
                          height: 1,
                          indent: 62,
                          color: AppColors.divider),
                  ]);
                }).toList(),
              ),
            ),
            const SizedBox(height: 20),
          ],

          if (_notYet.isNotEmpty) ...[
            const Text('Belum Absen',
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.amber)),
            const SizedBox(height: 10),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: _notYet.asMap().entries.map((e) {
                  final emp    = e.value as Map<String, dynamic>;
                  final isLast = e.key == _notYet.length - 1;
                  return Column(children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      child: Row(children: [
                        Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                              color: AppColors.amber100,
                              borderRadius: BorderRadius.circular(10)),
                          child: Center(
                              child: Text(
                                  (emp['name'] as String? ?? '?')[0],
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.amber))),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                            child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                          Text(emp['name'] ?? '-',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                  color: AppColors.textPrimary)),
                          Text(
                            [emp['department'], emp['employee_id']]
                                    .where((v) =>
                                        v != null &&
                                        v.toString().isNotEmpty)
                                    .join(' - ')
                                    .isEmpty
                                ? '-'
                                : [emp['department'], emp['employee_id']]
                                    .where((v) =>
                                        v != null &&
                                        v.toString().isNotEmpty)
                                    .join(' - '),
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted),
                          ),
                        ])),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                              color: AppColors.amber100,
                              borderRadius: BorderRadius.circular(8)),
                          child: const Text('Belum Absen',
                              style: TextStyle(
                                  fontSize: 10,
                                  color: AppColors.amber,
                                  fontWeight: FontWeight.w600)),
                        ),
                      ]),
                    ),
                    if (!isLast)
                      const Divider(
                          height: 1,
                          indent: 62,
                          color: AppColors.divider),
                  ]);
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Helper Widgets ────────────────────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  final String value, label;
  final Color color;
  const _StatCard(
      {required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Column(children: [
            Text(value,
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: color)),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w500)),
          ]),
        ),
      );
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
              width: 10,
              height: 10,
              decoration:
                  BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(label,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.textMuted)),
        ],
      );
}
