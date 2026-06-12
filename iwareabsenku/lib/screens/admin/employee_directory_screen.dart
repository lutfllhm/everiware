import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';

class EmployeeDirectoryScreen extends StatefulWidget {
  const EmployeeDirectoryScreen({super.key});

  @override
  State<EmployeeDirectoryScreen> createState() => _EmployeeDirectoryScreenState();
}

class _EmployeeDirectoryScreenState extends State<EmployeeDirectoryScreen> {
  List<Map<String, dynamic>> _employees = [];
  bool _loading = true;
  String _searchQuery = '';
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  bool _groupByLocation = true;
  String _selectedLocationFilter = 'Semua';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getAllUsers(search: _searchQuery.trim().isEmpty ? null : _searchQuery.trim());
      if (mounted) {
        setState(() {
          _employees = (data['users'] as List? ?? []).map((u) => Map<String, dynamic>.from(u)).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      setState(() => _searchQuery = query);
      _load();
    });
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('$label berhasil disalin ke clipboard 📋'),
      duration: const Duration(seconds: 2),
    ));
  }

  Widget _buildEmployeeCard(Map<String, dynamic> emp) {
    final phone = emp['phone'] as String? ?? '-';
    final email = emp['email'] as String? ?? '-';
    final isActive = emp['is_active'] == true || emp['is_active'] == 1;
    final faceRegistered = emp['face_registered'] == true || emp['face_registered'] == 1;
    final locationName = emp['location_name'] as String? ?? 'Tanpa Penempatan';

    String roleLabel = 'Karyawan';
    Color roleColor = AppColors.primary;
    if (emp['role'] == 'superadmin') {
      roleLabel = 'Super Admin';
      roleColor = AppColors.danger;
    } else if (emp['role'] == 'admin') {
      roleLabel = 'Admin';
      roleColor = AppColors.warning;
    } else if (emp['role'] == 'hrd') {
      roleLabel = 'HRD';
      roleColor = AppColors.teal;
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Profile & Status
          Row(
            children: [
              UserAvatar(
                name: emp['name'] ?? '?',
                size: 44,
                avatarFilename: emp['avatar'],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      emp['name'] ?? '-',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      ['📍 $locationName', emp['department'], emp['position']]
                          .where((v) => v != null && v.toString().isNotEmpty)
                          .join('  •  '),
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: roleColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      roleLabel,
                      style: TextStyle(
                        fontSize: 10,
                        color: roleColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isActive ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isActive ? 'Aktif' : 'Nonaktif',
                      style: TextStyle(
                        fontSize: 10,
                        color: isActive ? Colors.green : Colors.red,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(),
          const SizedBox(height: 8),
          // Contact details
          GestureDetector(
            onTap: () => _copyToClipboard(email, 'Email'),
            child: Row(
              children: [
                const Icon(Icons.email_outlined, size: 14, color: AppColors.textMuted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    email,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
                const Icon(Icons.copy_rounded, size: 12, color: AppColors.textMuted),
              ],
            ),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => _copyToClipboard(phone, 'Nomor HP'),
            child: Row(
              children: [
                const Icon(Icons.phone_outlined, size: 14, color: AppColors.textMuted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    phone,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
                const Icon(Icons.copy_rounded, size: 12, color: AppColors.textMuted),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Additional metadata (Verification status)
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.grey50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Verifikasi Wajah:',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                ),
                Row(
                  children: [
                    Icon(
                      faceRegistered ? Icons.check_circle_rounded : Icons.cancel_rounded,
                      size: 14,
                      color: faceRegistered ? Colors.green : Colors.red,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      faceRegistered ? 'Terdaftar' : 'Belum Terdaftar',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: faceRegistered ? Colors.green : Colors.red,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Build unique placements list
    final locations = ['Semua'];
    for (final emp in _employees) {
      final loc = emp['location_name'] as String? ?? 'Tanpa Penempatan';
      if (!locations.contains(loc)) {
        locations.add(loc);
      }
    }

    // Fallback if filter is not found in loaded data anymore
    if (!locations.contains(_selectedLocationFilter)) {
      _selectedLocationFilter = 'Semua';
    }

    // Filter list by selected placement
    final filtered = _employees.where((emp) {
      if (_selectedLocationFilter == 'Semua') return true;
      final loc = emp['location_name'] as String? ?? 'Tanpa Penempatan';
      return loc == _selectedLocationFilter;
    }).toList();

    // Grouping list if switch is active
    final Map<String, List<Map<String, dynamic>>> grouped = {};
    if (_groupByLocation) {
      for (final emp in filtered) {
        final loc = emp['location_name'] as String? ?? 'Tanpa Penempatan';
        grouped.putIfAbsent(loc, () => []).add(emp);
      }
    }

    final sortedKeys = grouped.keys.toList()
      ..sort((a, b) {
        if (a == 'Tanpa Penempatan') return 1;
        if (b == 'Tanpa Penempatan') return -1;
        return a.compareTo(b);
      });

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          const ProfileHeader(
            title: 'Daftar Karyawan',
            showBackButton: true,
          ),
          // Search Bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Cari nama, email, atau ID karyawan...',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        onPressed: () {
                          _searchCtrl.clear();
                          _onSearchChanged('');
                        },
                        icon: const Icon(Icons.close_rounded, size: 18),
                      )
                    : null,
                filled: true,
                fillColor: AppColors.grey50,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF8B1F1F), width: 1.5),
                ),
              ),
            ),
          ),
          // Grouping Toggle & Location Dropdown Panel
          Container(
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Kelompokkan per Penempatan',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      Switch.adaptive(
                        value: _groupByLocation,
                        activeColor: const Color(0xFF8B1F1F),
                        onChanged: (val) {
                          setState(() {
                            _groupByLocation = val;
                          });
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                if (_employees.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.grey50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border, width: 1.5),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedLocationFilter,
                          isExpanded: true,
                          icon: const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            size: 20,
                            color: AppColors.primary,
                          ),
                          dropdownColor: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                          items: locations.map((loc) {
                            return DropdownMenuItem<String>(
                              value: loc,
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.location_on_rounded,
                                    size: 14,
                                    color: AppColors.primary,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(loc),
                                ],
                              ),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _selectedLocationFilter = val;
                              });
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                const Divider(height: 1),
              ],
            ),
          ),
          // Employee List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF8B1F1F)))
                : RefreshIndicator(
                    onRefresh: _load,
                    color: const Color(0xFF8B1F1F),
                    child: _employees.isEmpty
                        ? const EmptyState(
                            icon: Icons.people_outline_rounded,
                            title: 'Tidak ada karyawan ditemukan',
                            subtitle: 'Coba ubah kata kunci pencarian Anda.',
                          )
                        : (filtered.isEmpty
                            ? const EmptyState(
                                icon: Icons.location_off_rounded,
                                title: 'Tidak ada karyawan di penempatan ini',
                                subtitle: 'Coba pilih penempatan lain atau reset filter.',
                              )
                            : (_groupByLocation
                                ? ListView.builder(
                                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                                    itemCount: sortedKeys.length,
                                    itemBuilder: (context, sectionIndex) {
                                      final locName = sortedKeys[sectionIndex];
                                      final emps = grouped[locName]!;
                                      return Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Padding(
                                            padding: const EdgeInsets.only(top: 16, bottom: 8, left: 4),
                                            child: Row(
                                              children: [
                                                const Icon(
                                                  Icons.location_on_rounded,
                                                  size: 15,
                                                  color: Color(0xFF8B1F1F),
                                                ),
                                                const SizedBox(width: 6),
                                                Text(
                                                  locName,
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 13,
                                                    color: AppColors.textPrimary,
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF8B1F1F).withValues(alpha: 0.1),
                                                    borderRadius: BorderRadius.circular(10),
                                                  ),
                                                  child: Text(
                                                    '${emps.length}',
                                                    style: const TextStyle(
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.bold,
                                                      color: Color(0xFF8B1F1F),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          ...emps.map((emp) => Padding(
                                                padding: const EdgeInsets.only(bottom: 12),
                                                child: _buildEmployeeCard(emp),
                                              )),
                                        ],
                                      );
                                    },
                                  )
                                : ListView.separated(
                                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                                    itemCount: filtered.length,
                                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                                    itemBuilder: (_, i) => _buildEmployeeCard(filtered[i]),
                                  ))),
                  ),
          ),
        ],
      ),
    );
  }
}
