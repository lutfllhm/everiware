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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Daftar Karyawan'),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: Column(
        children: [
          // Search Bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
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
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                            itemCount: _employees.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemBuilder: (_, i) {
                              final emp = _employees[i];
                              final phone = emp['phone'] as String? ?? '-';
                              final email = emp['email'] as String? ?? '-';
                              final isActive = emp['is_active'] == true || emp['is_active'] == 1;
                              final faceRegistered = emp['face_registered'] == true || emp['face_registered'] == 1;

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
                                                [emp['department'], emp['position'], emp['employee_id']]
                                                    .where((v) => v != null && v.toString().isNotEmpty)
                                                    .join('  -  '),
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
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}
