import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/animations.dart';

class AttendanceHistoryScreen extends StatefulWidget {
  const AttendanceHistoryScreen({super.key});
  @override
  State<AttendanceHistoryScreen> createState() =>
      _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  List<AttendanceModel> _attendances = [];
  bool _loading = true;
  int _selectedMonth = DateTime.now().month;
  int _selectedYear = DateTime.now().year;
  String _filterStatus = 'all';

  final _months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getMyAttendance(
          month: _selectedMonth, year: _selectedYear);
      if (mounted) {
        setState(() {
          _attendances = (data['attendances'] as List? ?? [])
              .map((a) => AttendanceModel.fromJson(a))
              .toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<AttendanceModel> get _filtered {
    if (_filterStatus == 'all') return _attendances;
    return _attendances.where((a) => a.status == _filterStatus).toList();
  }

  int get _present  => _attendances.where((a) => a.status == 'present').length;
  int get _late     => _attendances.where((a) => a.status == 'late').length;
  int get _absent   => _attendances.where((a) => a.status == 'absent').length;
  int get _leave    => _attendances.where((a) => a.status == 'leave').length;
  int get _sick     => _attendances.where((a) => a.status == 'sick').length;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: Column(children: [

          // â”€â”€ Hero Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Container(
            decoration: const BoxDecoration(
              color: AppColors.primary,
            borderRadius: BorderRadius.only(
              bottomLeft: Radius.circular(24),
              bottomRight: Radius.circular(24),
            ),
            ),
            child: SafeArea(
              bottom: false,
              child: Column(children: [
                // Top bar
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
                  child: Row(children: [
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded,
                          color: Colors.white, size: 18),
                    ),
                    const Expanded(
                      child: Text(
                        'Riwayat Absensi',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _loadData,
                      icon: const Icon(Icons.refresh_rounded,
                          color: Colors.white, size: 20),
                    ),
                  ]),
                ),

                // Stats summary row
                if (!_loading && _attendances.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                    child: Row(children: [
                      _HeroStat(value: '$_present', label: 'Hadir',
                          color: const Color(0xFF4ADE80)),
                      _HeroStat(value: '$_late', label: 'Terlambat',
                          color: const Color(0xFFFBBF24)),
                      _HeroStat(value: '$_absent', label: 'Absen',
                          color: const Color(0xFFF87171)),
                      _HeroStat(value: '$_leave', label: 'Cuti',
                          color: const Color(0xFF93C5FD)),
                      _HeroStat(value: '$_sick', label: 'Sakit',
                          color: const Color(0xFFD8B4FE)),
                    ]),
                  )
                else
                  const SizedBox(height: 24),
              ]),
            ),
          ),

          // â”€â”€ Filter bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Column(children: [
              // Month + Year dropdowns
              Row(children: [
                Expanded(
                  child: _DropdownBox(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: _selectedMonth,
                        isDense: true,
                        icon: const Icon(Icons.keyboard_arrow_down_rounded,
                            size: 18, color: AppColors.textMuted),
                        items: List.generate(12, (i) => DropdownMenuItem(
                          value: i + 1,
                          child: Text(_months[i],
                              style: const TextStyle(fontSize: 13,
                                  fontWeight: FontWeight.w500)),
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
                _DropdownBox(
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<int>(
                      value: _selectedYear,
                      isDense: true,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded,
                          size: 18, color: AppColors.textMuted),
                      items: [2024, 2025, 2026].map((y) => DropdownMenuItem(
                        value: y,
                        child: Text('$y',
                            style: const TextStyle(fontSize: 13,
                                fontWeight: FontWeight.w500)),
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
              ]),

              // Status filter chips
              if (!_loading && _attendances.isNotEmpty) ...[
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    _FilterChip(label: 'Semua', count: _attendances.length,
                        color: AppColors.primary,
                        active: _filterStatus == 'all',
                        onTap: () => setState(() => _filterStatus = 'all')),
                    const SizedBox(width: 8),
                    _FilterChip(label: 'Hadir', count: _present,
                        color: AppColors.teal,
                        active: _filterStatus == 'present',
                        onTap: () => setState(() => _filterStatus = 'present')),
                    const SizedBox(width: 8),
                    _FilterChip(label: 'Terlambat', count: _late,
                        color: AppColors.amber,
                        active: _filterStatus == 'late',
                        onTap: () => setState(() => _filterStatus = 'late')),
                    const SizedBox(width: 8),
                    _FilterChip(label: 'Absen', count: _absent,
                        color: AppColors.danger,
                        active: _filterStatus == 'absent',
                        onTap: () => setState(() => _filterStatus = 'absent')),
                    const SizedBox(width: 8),
                    _FilterChip(label: 'Cuti', count: _leave,
                        color: AppColors.sky,
                        active: _filterStatus == 'leave',
                        onTap: () => setState(() => _filterStatus = 'leave')),
                    const SizedBox(width: 8),
                    _FilterChip(label: 'Sakit', count: _sick,
                        color: const Color(0xFFa855f7),
                        active: _filterStatus == 'sick',
                        onTap: () => setState(() => _filterStatus = 'sick')),
                  ]),
                ),
              ],
            ]),
          ),

          const Divider(height: 1, color: AppColors.divider),

          // â”€â”€ List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Expanded(
            child: _loading
                ? _buildShimmer()
                : _filtered.isEmpty
                    ? EmptyState(
                        icon: Icons.event_busy_outlined,
                        title: 'Tidak ada data',
                        subtitle: 'Tidak ada absensi untuk\nfilter yang dipilih',
                      )
                    : RefreshIndicator(
                        onRefresh: _loadData,
                        color: AppColors.primary,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) => FadeSlideIn(
                            delay: Duration(milliseconds: 40 * i),
                            child: _AttendanceItem(att: _filtered[i]),
                          ),
                        ),
                      ),
          ),
        ]),
      ),
    );
  }

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 6,
    separatorBuilder: (_, __) => const SizedBox(height: 10),
    itemBuilder: (_, __) => Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(children: [
        const ShimmerBox(width: 52, height: 56, radius: 14),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ShimmerBox(width: MediaQuery.of(context).size.width * 0.4, height: 14, radius: 7),
          const SizedBox(height: 8),
          ShimmerBox(width: MediaQuery.of(context).size.width * 0.6, height: 12, radius: 6),
        ])),
        const ShimmerBox(width: 60, height: 24, radius: 12),
      ]),
    ),
  );
}

// â”€â”€ Attendance Item Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _AttendanceItem extends StatelessWidget {
  final AttendanceModel att;
  const _AttendanceItem({required this.att});

  @override
  Widget build(BuildContext context) {
    final date = DateTime.parse(att.date);
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          // Date badge
          Container(
            width: 52, height: 56,
            decoration: BoxDecoration(
              gradient: AppColors.primaryGradient,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.22),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(DateFormat('d').format(date),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800,
                      color: Colors.white, height: 1)),
              Text(DateFormat('MMM', 'id_ID').format(date),
                  style: const TextStyle(fontSize: 10, color: Colors.white70,
                      fontWeight: FontWeight.w600)),
            ]),
          ),
          const SizedBox(width: 14),
          // Info
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(DateFormat('EEEE', 'id_ID').format(date),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 5),
            Row(children: [
              _TimeTag(icon: Icons.login_rounded, time: att.checkIn != null
                  ? DateFormat('HH:mm').format(att.checkIn!) : '--:--',
                  color: AppColors.teal),
              const SizedBox(width: 8),
              _TimeTag(icon: Icons.logout_rounded, time: att.checkOut != null
                  ? DateFormat('HH:mm').format(att.checkOut!) : '--:--',
                  color: AppColors.primary),
            ]),
            if (att.locationName != null) ...[
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.location_on_outlined, size: 11,
                    color: AppColors.textMuted),
                const SizedBox(width: 3),
                Flexible(child: Text(att.locationName!,
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    overflow: TextOverflow.ellipsis)),
              ]),
            ],
          ])),
          StatusBadge(status: att.status),
        ]),
      ),
    );
  }
}

class _TimeTag extends StatelessWidget {
  final IconData icon;
  final String time;
  final Color color;
  const _TimeTag({required this.icon, required this.time, required this.color});

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 12, color: color),
    const SizedBox(width: 3),
    Text(time, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
  ]);
}

// ——————————————————————————————————————————————————————————————————————————————
class _HeroStat extends StatelessWidget {
  final String value, label;
  final Color color;
  const _HeroStat({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(children: [
      Text(value, style: TextStyle(
        color: color, fontSize: 22, fontWeight: FontWeight.w800, height: 1)),
      const SizedBox(height: 3),
      Text(label, style: TextStyle(
        color: Colors.white.withValues(alpha: 0.65), fontSize: 10,
        fontWeight: FontWeight.w500)),
    ]),
  );
}

// ——————————————————————————————————————————————————————————————————————————————
class _DropdownBox extends StatelessWidget {
  final Widget child;
  const _DropdownBox({required this.child});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: AppColors.grey100,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.border),
    ),
    child: child,
  );
}

// ——————————————————————————————————————————————————————————————————————————————
class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final bool active;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label, required this.count, required this.color,
    required this.active, required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: () {
      HapticFeedback.selectionClick();
      onTap();
    },
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        gradient: active ? LinearGradient(
          colors: [color, color.withValues(alpha: 0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ) : null,
        color: active ? null : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: active ? Colors.transparent : color.withValues(alpha: 0.3),
        ),
        boxShadow: active ? [
          BoxShadow(
            color: color.withValues(alpha: 0.25),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ] : [],
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: TextStyle(
          fontSize: 12, fontWeight: FontWeight.w600,
          color: active ? Colors.white : color)),
        const SizedBox(width: 5),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
          decoration: BoxDecoration(
            color: active ? Colors.white.withValues(alpha: 0.25)
                : color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text('$count', style: TextStyle(
            fontSize: 10, fontWeight: FontWeight.w700,
            color: active ? Colors.white : color)),
        ),
      ]),
    ),
  );
}


