import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../services/auth_provider.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';

/// Halaman statistik pribadi karyawan - Statistik User dengan Pie Chart & Aktivitas Timeline
class MyStatsScreen extends StatefulWidget {
  const MyStatsScreen({super.key});
  @override
  State<MyStatsScreen> createState() => _MyStatsScreenState();
}

class _MyStatsScreenState extends State<MyStatsScreen> {
  List<AttendanceModel> _attendances = [];
  List<LeaveModel> _leaves = [];
  List<OvertimeModel> _overtimes = [];
  List<UserActivity> _activities = [];
  Map<String, dynamic>? _quota;
  bool _loading = true;
  int _selectedMonth = DateTime.now().month;
  int _selectedYear  = DateTime.now().year;
  int _touchedIndex = -1;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService().getMyAttendance(month: _selectedMonth, year: _selectedYear),
        ApiService().getLeaveQuota(),
        ApiService().getMyLeaves(),
        ApiService().getMyOvertime(),
      ]);
      if (mounted) {
        setState(() {
          _attendances = (results[0]['attendances'] as List? ?? [])
              .map((a) => AttendanceModel.fromJson(a))
              .toList();
          _quota = results[1]['quota'];
          
          _leaves = (results[2]['leaves'] as List? ?? [])
              .map((l) => LeaveModel.fromJson(l))
              .toList();
              
          _overtimes = (results[3]['overtimes'] as List? ?? [])
              .map((o) => OvertimeModel.fromJson(o))
              .toList();
              
          _buildActivitiesList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _buildActivitiesList() {
    final List<UserActivity> temp = [];

    // 1. Tambah data Absensi
    for (final att in _attendances) {
      final dateStr = att.date;
      
      if (att.checkIn != null) {
        final isLate = att.status == 'late';
        temp.add(UserActivity(
          id: '${att.id}_in',
          type: 'checkin',
          timestamp: att.checkIn!,
          title: 'Absen Masuk',
          description: 'Melakukan absensi masuk di ${att.locationName ?? "Kantor"} pada pukul ${DateFormat('HH:mm').format(att.checkIn!)}.',
          status: isLate ? 'Terlambat' : 'Tepat Waktu',
          statusColor: isLate ? AppColors.amber : AppColors.teal,
          icon: Icons.login_rounded,
          iconColor: isLate ? AppColors.amber : AppColors.teal,
        ));
      }
      
      if (att.checkOut != null) {
        temp.add(UserActivity(
          id: '${att.id}_out',
          type: 'checkout',
          timestamp: att.checkOut!,
          title: 'Absen Pulang',
          description: 'Melakukan absensi pulang di ${att.locationName ?? "Kantor"} pada pukul ${DateFormat('HH:mm').format(att.checkOut!)}.',
          status: 'Selesai',
          statusColor: AppColors.teal,
          icon: Icons.logout_rounded,
          iconColor: AppColors.primary,
        ));
      }

      if (att.checkIn == null && att.checkOut == null) {
        if (att.status == 'absent') {
          final dt = DateTime.tryParse('$dateStr 08:00:00') ?? DateTime.now();
          temp.add(UserActivity(
            id: '${att.id}_absent',
            type: 'absent',
            timestamp: dt,
            title: 'Mangkir / Tidak Hadir',
            description: 'Tidak ada riwayat absensi masuk untuk hari ini.',
            status: 'Tidak Hadir',
            statusColor: AppColors.danger,
            icon: Icons.warning_amber_rounded,
            iconColor: AppColors.danger,
          ));
        }
      }
    }

    // 2. Tambah data Cuti / Izin
    for (final leave in _leaves) {
      Color sColor = AppColors.amber;
      if (leave.status == 'approved') sColor = AppColors.teal;
      if (leave.status == 'rejected') sColor = AppColors.danger;

      temp.add(UserActivity(
        id: leave.id,
        type: 'leave',
        timestamp: leave.createdAt,
        title: 'Pengajuan ${leave.typeLabel}',
        description: 'Periode: ${leave.startDate} s/d ${leave.endDate} (${leave.totalDays} hari)\nAlasan: ${leave.reason}',
        status: leave.statusLabel,
        statusColor: sColor,
        icon: Icons.date_range_rounded,
        iconColor: sColor,
      ));
    }

    // 3. Tambah data Lembur
    for (final overtime in _overtimes) {
      Color sColor = AppColors.amber;
      if (overtime.status == 'approved') sColor = AppColors.teal;
      if (overtime.status == 'rejected') sColor = AppColors.danger;

      temp.add(UserActivity(
        id: overtime.id,
        type: 'overtime',
        timestamp: overtime.createdAt,
        title: 'Pengajuan Lembur',
        description: 'Tanggal: ${overtime.date}\nDurasi: ${overtime.durationLabel}\nKeperluan: ${overtime.reason}',
        status: overtime.statusLabel,
        statusColor: sColor,
        icon: Icons.more_time_rounded,
        iconColor: sColor,
      ));
    }

    // Urutkan berdasarkan waktu terbaru
    temp.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    _activities = temp;
  }

  // Hitung statistik
  int get _present   => _attendances.where((a) => a.status == 'present').length;
  int get _late      => _attendances.where((a) => a.status == 'late').length;
  int get _absent    => _attendances.where((a) => a.status == 'absent').length;
  int get _leave     => _attendances.where((a) => a.status == 'leave').length;
  int get _sick      => _attendances.where((a) => a.status == 'sick').length;
  int get _total     => _attendances.length;

  double get _attendanceRate {
    if (_total == 0) return 0;
    return (_present + _late) / _total * 100;
  }

  // Rata-rata jam masuk
  String get _avgCheckIn {
    final checkins = _attendances.where((a) => a.checkIn != null).toList();
    if (checkins.isEmpty) return '--:--';
    final totalMinutes = checkins.fold<int>(0, (sum, a) =>
        sum + a.checkIn!.hour * 60 + a.checkIn!.minute);
    final avg = totalMinutes ~/ checkins.length;
    return '${(avg ~/ 60).toString().padLeft(2,'0')}:${(avg % 60).toString().padLeft(2,'0')}';
  }

  final _months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  List<PieChartSectionData> _buildPieSections() {
    final list = <Map<String, dynamic>>[];
    if (_present > 0) list.add({'value': _present.toDouble(), 'color': AppColors.teal, 'title': '$_present'});
    if (_late > 0) list.add({'value': _late.toDouble(), 'color': AppColors.amber, 'title': '$_late'});
    if (_absent > 0) list.add({'value': _absent.toDouble(), 'color': AppColors.danger, 'title': '$_absent'});
    if (_leave > 0) list.add({'value': _leave.toDouble(), 'color': AppColors.sky, 'title': '$_leave'});
    if (_sick > 0) list.add({'value': _sick.toDouble(), 'color': const Color(0xFFa855f7), 'title': '$_sick'});

    if (list.isEmpty) {
      return [
        PieChartSectionData(
          color: AppColors.grey300,
          value: 1.0,
          title: '0',
          radius: 40,
          titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
        )
      ];
    }

    return List.generate(list.length, (i) {
      final isTouched = i == _touchedIndex;
      final double radius = isTouched ? 55 : 45;
      final double fontSize = isTouched ? 16 : 12;
      final item = list[i];
      return PieChartSectionData(
        color: item['color'],
        value: item['value'],
        title: item['title'],
        radius: radius,
        titleStyle: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      );
    });
  }

  Widget _buildHeroHeader(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    return ProfileHeader(
      title: 'Statistik User',
      showBackButton: true,
      name: user?.name,
      avatarFilename: user?.avatar,
      position: user?.position ?? user?.roleLabel ?? '',
      department: user != null && ((user.department ?? '').isNotEmpty || user.deptPosition != '-')
          ? ((user.department ?? '').isNotEmpty ? user.department! : user.deptPosition)
          : null,
      bottomWidget: const TabBar(
        tabs: [
          Tab(text: 'Ringkasan'),
          Tab(text: 'Aktivitas'),
        ],
        indicatorColor: Color(0xFFEF5350),
        labelColor: Colors.white,
        unselectedLabelColor: Colors.white70,
        labelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
        indicatorSize: TabBarIndicatorSize.label,
        indicatorWeight: 3,
        dividerColor: Colors.transparent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Scaffold(
          backgroundColor: AppColors.surface,
          body: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                )
              : NestedScrollView(
                  headerSliverBuilder: (context, innerBoxIsScrolled) => [
                    SliverToBoxAdapter(child: _buildHeroHeader(context)),
                  ],
                  body: TabBarView(
                    children: [
                      _buildOverviewTab(),
                      _buildActivitiesTab(),
                    ],
                  ),
                ),
        ),
      ),
    );
  }


  Widget _buildOverviewTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          _buildFilterRow(),
          const SizedBox(height: 16),
          _buildAttendanceRateCard(),
          const SizedBox(height: 16),
          _buildPieChartCard(),
          const SizedBox(height: 16),
          if (_quota != null) ...[
            _buildQuotaCard(),
            const SizedBox(height: 16),
          ],
          _buildBreakdownCard(),
          const SizedBox(height: 16),
          if (_attendances.isNotEmpty) ...[
            _buildHistoryCard(),
          ],
        ],
      ),
    );
  }

  Widget _buildActivitiesTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: _activities.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(
                  height: MediaQuery.of(context).size.height * 0.6,
                  child: const Center(
                    child: Text(
                      'Belum ada aktivitas tercatat.',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ),
                ),
              ],
            )
          : ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 100),
              itemCount: _activities.length,
              itemBuilder: (context, index) {
                final activity = _activities[index];
                final isLast = index == _activities.length - 1;
                return _buildTimelineItem(activity, isLast);
              },
            ),
    );
  }

  Widget _buildFilterRow() {
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: _selectedMonth,
                items: List.generate(12, (i) => DropdownMenuItem(
                  value: i + 1,
                  child: Text(_months[i], style: const TextStyle(fontSize: 14)),
                )),
                onChanged: (v) {
                  if (v != null) {
                    setState(() => _selectedMonth = v);
                    _loadData();
                  }
                },
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: _selectedYear,
                items: [2024, 2025, 2026].map((y) => DropdownMenuItem(
                  value: y,
                  child: Text('$y', style: const TextStyle(fontSize: 14)),
                )).toList(),
                onChanged: (v) {
                  if (v != null) {
                    setState(() => _selectedYear = v);
                    _loadData();
                  }
                },
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAttendanceRateCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8B1F1F), Color(0xFFE53935)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8B1F1F).withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            '${_attendanceRate.toStringAsFixed(1)}%',
            style: const TextStyle(color: Colors.white, fontSize: 48, fontWeight: FontWeight.w900, height: 1),
          ),
          const SizedBox(height: 4),
          const Text('Tingkat Kehadiran', style: TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: _attendanceRate / 100,
              backgroundColor: Colors.white.withValues(alpha: 0.2),
              valueColor: const AlwaysStoppedAnimation(Colors.white),
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _MiniStat(value: '$_total', label: 'Total Hari'),
              _MiniStat(value: _avgCheckIn, label: 'Rata Masuk'),
              _MiniStat(value: '${_late > 0 ? _late : 0} H', label: 'Terlambat'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPieChartCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Grafik Distribusi Kehadiran',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: SizedBox(
                  height: 150,
                  child: PieChart(
                    PieChartData(
                      pieTouchData: PieTouchData(
                        touchCallback: (FlTouchEvent event, pieTouchResponse) {
                          setState(() {
                            if (!event.isInterestedForInteractions ||
                                pieTouchResponse == null ||
                                pieTouchResponse.touchedSection == null) {
                              _touchedIndex = -1;
                              return;
                            }
                            _touchedIndex = pieTouchResponse.touchedSection!.touchedSectionIndex;
                          });
                        },
                      ),
                      borderData: FlBorderData(show: false),
                      sectionsSpace: 2,
                      centerSpaceRadius: 30,
                      sections: _buildPieSections(),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _LegendItem(color: AppColors.teal, label: 'Hadir ($_present)'),
                    const SizedBox(height: 6),
                    _LegendItem(color: AppColors.amber, label: 'Terlambat ($_late)'),
                    const SizedBox(height: 6),
                    _LegendItem(color: AppColors.danger, label: 'Absen ($_absent)'),
                    const SizedBox(height: 6),
                    _LegendItem(color: AppColors.sky, label: 'Cuti ($_leave)'),
                    const SizedBox(height: 6),
                    _LegendItem(color: const Color(0xFFa855f7), label: 'Sakit ($_sick)'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuotaCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Jatah Cuti ${_quota?['year'] ?? ''}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary)),
          const SizedBox(height: 14),
          Row(
            children: [
              _QuotaBox(value: '${_quota?['total_days'] ?? 0}',     label: 'Total',    color: AppColors.textPrimary),
              const SizedBox(width: 10),
              _QuotaBox(value: '${_quota?['used_days'] ?? 0}',      label: 'Terpakai', color: const Color(0xFF8B1F1F)),
              const SizedBox(width: 10),
              _QuotaBox(value: '${_quota?['remaining_days'] ?? 0}', label: 'Sisa',     color: AppColors.teal),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: ((_quota?['total_days'] as num?)?.toDouble() ?? 0.0) > 0
                  ? ((_quota?['used_days'] as num?)?.toDouble() ?? 0.0) / ((_quota?['total_days'] as num?)?.toDouble() ?? 1.0)
                  : 0,
              backgroundColor: AppColors.grey100,
              valueColor: const AlwaysStoppedAnimation(Color(0xFF8B1F1F)),
              minHeight: 8,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreakdownCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Rincian Status', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary)),
          const SizedBox(height: 14),
          _StatRow(label: 'Hadir',       value: _present, total: _total, color: AppColors.teal),
          _StatRow(label: 'Terlambat',   value: _late,    total: _total, color: AppColors.amber),
          _StatRow(label: 'Tidak Hadir', value: _absent,  total: _total, color: AppColors.danger),
          _StatRow(label: 'Cuti',        value: _leave,   total: _total, color: AppColors.sky),
          _StatRow(label: 'Sakit',       value: _sick,    total: _total, color: const Color(0xFFa855f7)),
        ],
      ),
    );
  }

  Widget _buildHistoryCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Riwayat Bulan Ini',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary)),
        const SizedBox(height: 10),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: _attendances.take(20).toList().asMap().entries.map((e) {
              final att = e.value;
              final isLast = e.key == (_attendances.length > 20 ? 19 : _attendances.length - 1);
              final date = DateTime.parse(att.date);
              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF8B1F1F), Color(0xFFE53935)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(DateFormat('d').format(date),
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                              Text(DateFormat('MMM', 'id_ID').format(date),
                                  style: const TextStyle(fontSize: 9, color: Colors.white70, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(DateFormat('EEEE', 'id_ID').format(date),
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
                              const SizedBox(height: 2),
                              Text(
                                '${att.checkIn != null ? DateFormat('HH:mm').format(att.checkIn!) : '--:--'}   -   ${att.checkOut != null ? DateFormat('HH:mm').format(att.checkOut!) : '--:--'}',
                                style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        StatusBadge(status: att.status),
                      ],
                    ),
                  ),
                  if (!isLast) const Divider(height: 1, indent: 72, color: AppColors.divider),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildTimelineItem(UserActivity activity, bool isLast) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: activity.iconColor.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                  border: Border.all(color: activity.iconColor, width: 2),
                ),
                child: Icon(activity.icon, size: 18, color: activity.iconColor),
              ),
              Expanded(
                child: isLast
                    ? const SizedBox.shrink()
                    : Container(
                        width: 2,
                        color: AppColors.divider,
                      ),
              ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEEEEEE), width: 1),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            activity.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: activity.statusColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            activity.status,
                            style: TextStyle(
                              color: activity.statusColor,
                              fontWeight: FontWeight.w700,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat('d MMMM yyyy, HH:mm', 'id_ID').format(activity.timestamp),
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      activity.description,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String value, label;
  const _MiniStat({required this.value, required this.label});
  @override
  Widget build(BuildContext context) => Column(children: [
    Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
    Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10)),
  ]);
}

class _StatRow extends StatelessWidget {
  final String label;
  final int value, total;
  final Color color;
  const _StatRow({required this.label, required this.value, required this.total, required this.color});

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? value / total : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
          Row(children: [
            Text('$value hari', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
            const SizedBox(width: 6),
            Text('(${(pct * 100).toStringAsFixed(0)}%)', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ]),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: pct.toDouble(),
            backgroundColor: AppColors.grey100,
            valueColor: AlwaysStoppedAnimation(color),
            minHeight: 6,
          ),
        ),
      ]),
    );
  }
}

class _QuotaBox extends StatelessWidget {
  final String value, label;
  final Color color;
  const _QuotaBox({required this.value, required this.label, required this.color});
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(color: AppColors.grey100, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
      ]),
    ),
  );
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class UserActivity {
  final String id;
  final String type; // 'checkin', 'checkout', 'leave', 'overtime', 'absent'
  final DateTime timestamp;
  final String title;
  final String description;
  final String status;
  final Color statusColor;
  final IconData icon;
  final Color iconColor;

  UserActivity({
    required this.id,
    required this.type,
    required this.timestamp,
    required this.title,
    required this.description,
    required this.status,
    required this.statusColor,
    required this.icon,
    required this.iconColor,
  });
}
