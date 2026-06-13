import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';

class CreateAnnouncementScreen extends StatefulWidget {
  final Map<String, dynamic>? announcement;
  const CreateAnnouncementScreen({super.key, this.announcement});

  @override
  State<CreateAnnouncementScreen> createState() => _CreateAnnouncementScreenState();
}

class _CreateAnnouncementScreenState extends State<CreateAnnouncementScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  String _type = 'info';
  bool _isHoliday = false;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    if (widget.announcement != null) {
      final ann = widget.announcement!;
      _titleCtrl.text = ann['title']?.toString() ?? '';
      _contentCtrl.text = ann['content']?.toString() ?? '';
      _type = ann['type']?.toString().toLowerCase() ?? 'info';
      _isHoliday = ann['is_holiday'] == 1 || ann['is_holiday'] == true || ann['is_holiday'] == 'true';
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);
    HapticFeedback.mediumImpact();
    try {
      final bool isEdit = widget.announcement != null;
      final Map<String, dynamic> res;

      if (isEdit) {
        res = await ApiService().updateAnnouncement(
          widget.announcement!['id'] as String,
          _titleCtrl.text.trim(),
          _contentCtrl.text.trim(),
          type: _type,
          isHoliday: _isHoliday,
        );
      } else {
        res = await ApiService().createAnnouncement(
          _titleCtrl.text.trim(),
          _contentCtrl.text.trim(),
          type: _type,
          isHoliday: _isHoliday,
        );
      }

      if (!mounted) return;
      setState(() => _loading = false);

      if (res['success'] == true) {
        _titleCtrl.clear();
        _contentCtrl.clear();
        setState(() {
          _type = 'info';
          _isHoliday = false;
        });

        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: AppColors.success, size: 24),
                SizedBox(width: 8),
                Text('Berhasil', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              ],
            ),
            content: Text(
              res['message'] ?? (isEdit ? 'Pengumuman perusahaan berhasil diperbarui.' : 'Pengumuman perusahaan berhasil diterbitkan.'),
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context); // Pop dialog
                  Navigator.pop(context); // Return to previous screen
                },
                child: const Text('OK', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary)),
              ),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['message'] ?? 'Gagal memproses pengumuman'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Terjadi kesalahan server'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isEdit = widget.announcement != null;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          ProfileHeader(
            title: isEdit ? 'Edit Pengumuman' : 'Buat Pengumuman',
            showBackButton: true,
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: AppCard(
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: AppColors.primaryBg,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.campaign_rounded,
                              color: AppColors.primary,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isEdit ? 'Ubah Pengumuman' : 'Buat Pengumuman Baru',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  isEdit ? 'Ubah informasi penting perusahaan.' : 'Tampilkan informasi penting di beranda karyawan.',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Judul Pengumuman',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _titleCtrl,
                        decoration: const InputDecoration(
                          hintText: 'Masukkan judul pengumuman...',
                        ),
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) return 'Judul wajib diisi';
                          return null;
                        },
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Kategori / Tipe',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: _type,
                        dropdownColor: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        decoration: const InputDecoration(
                          contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'info', child: Text('Info / Pengumuman Umum')),
                          DropdownMenuItem(value: 'warning', child: Text('Penting / Peringatan')),
                          DropdownMenuItem(value: 'success', child: Text('Prestasi / Selamat')),
                          DropdownMenuItem(value: 'holiday', child: Text('Hari Libur / Perayaan')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _type = val;
                              if (_type == 'holiday') {
                                _isHoliday = true;
                              }
                            });
                          }
                        },
                      ),
                      const SizedBox(height: 18),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Tandai sebagai Hari Libur',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Mengubah visual pengumuman menjadi khusus hari libur.',
                                  style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                                ),
                              ],
                            ),
                          ),
                          Switch.adaptive(
                            value: _isHoliday,
                            activeColor: AppColors.primary,
                            onChanged: (val) {
                              setState(() {
                                _isHoliday = val;
                                if (_isHoliday) {
                                  _type = 'holiday';
                                } else if (_type == 'holiday') {
                                  _type = 'info';
                                }
                              });
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Isi Pengumuman',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _contentCtrl,
                        maxLines: 6,
                        decoration: const InputDecoration(
                          hintText: 'Tulis detail pengumuman secara lengkap di sini...',
                        ),
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) return 'Isi pengumuman wajib diisi';
                          return null;
                        },
                      ),
                      const SizedBox(height: 28),
                      PrimaryButton(
                        text: isEdit ? 'Simpan Perubahan 💾' : 'Publikasikan Pengumuman 📢',
                        color: AppColors.primary,
                        onPressed: _loading ? null : _submit,
                        isLoading: _loading,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
