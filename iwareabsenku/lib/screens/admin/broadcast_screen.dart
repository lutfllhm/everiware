import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';

class BroadcastScreen extends StatefulWidget {
  const BroadcastScreen({super.key});

  @override
  State<BroadcastScreen> createState() => _BroadcastScreenState();
}

class _BroadcastScreenState extends State<BroadcastScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();
  String _type = 'info';
  String _targetDept = 'all';
  String _targetLoc = 'all';
  List<Map<String, dynamic>> _locations = [];
  bool _loading = false;
  bool _loadingLocations = true;

  @override
  void initState() {
    super.initState();
    _loadLocations();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _messageCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadLocations() async {
    try {
      final res = await ApiService().getLocations();
      if (res['success'] == true && res['locations'] != null) {
        if (mounted) {
          setState(() {
            _locations = (res['locations'] as List).cast<Map<String, dynamic>>();
            _loadingLocations = false;
          });
        }
      } else {
        if (mounted) setState(() => _loadingLocations = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);
    HapticFeedback.mediumImpact();
    try {
      final res = await ApiService().broadcastNotification(
        _titleCtrl.text.trim(),
        _messageCtrl.text.trim(),
        type: _type,
        department: _targetDept == 'all' ? null : _targetDept,
        locationId: _targetLoc == 'all' ? null : _targetLoc,
      );

      if (!mounted) return;
      setState(() => _loading = false);

      if (res['success'] == true) {
        _titleCtrl.clear();
        _messageCtrl.clear();
        setState(() {
          _type = 'info';
          _targetDept = 'all';
          _targetLoc = 'all';
        });

        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: AppColors.teal, size: 24),
                SizedBox(width: 8),
                Text('Berhasil dikirim', style: TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            content: Text(res['message'] ?? 'Pengumuman telah berhasil disiarkan.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(res['message'] ?? 'Gagal mengirim pengumuman'),
          backgroundColor: AppColors.danger,
        ));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Terjadi kesalahan server'),
          backgroundColor: AppColors.danger,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          const ProfileHeader(
            title: 'Kirim Pengumuman (Broadcast)',
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
                        color: const Color(0xFFF5F0F0),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.campaign_rounded,
                        color: Color(0xFF8B1F1F),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Buat Siaran Baru',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Kirimkan notifikasi push instan ke target karyawan.',
                            style: TextStyle(fontSize: 11, color: AppColors.textMuted),
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
                  'Kategori / Tipe Notifikasi',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: const InputDecoration(
                    contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'info', child: Text('Info / Pengumuman Umum')),
                    DropdownMenuItem(value: 'warning', child: Text('Penting / Peringatan')),
                    DropdownMenuItem(value: 'success', child: Text('Prestasi / Selamat')),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _type = val);
                  },
                ),
                const SizedBox(height: 18),
                const Text(
                  'Target Departemen',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _targetDept,
                  decoration: const InputDecoration(
                    contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'all', child: Text('Semua Departemen')),
                    DropdownMenuItem(value: 'IT', child: Text('Teknologi Informasi (IT)')),
                    DropdownMenuItem(value: 'HRD', child: Text('Human Resources (HRD)')),
                    DropdownMenuItem(value: 'Finance', child: Text('Finance & Accounting')),
                    DropdownMenuItem(value: 'Operational', child: Text('Operational')),
                    DropdownMenuItem(value: 'Marketing', child: Text('Marketing & Sales')),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _targetDept = val);
                  },
                ),
                const SizedBox(height: 18),
                const Text(
                  'Target Cabang / Lokasi Kantor',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _targetLoc,
                  decoration: const InputDecoration(
                    contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                  items: [
                    const DropdownMenuItem(value: 'all', child: Text('Semua Lokasi')),
                    ..._locations.map((loc) => DropdownMenuItem(
                      value: loc['id']?.toString() ?? '',
                      child: Text(loc['name']?.toString() ?? '-'),
                    )),
                  ],
                  onChanged: _loadingLocations ? null : (val) {
                    if (val != null) setState(() => _targetLoc = val);
                  },
                ),
                const SizedBox(height: 18),
                const Text(
                  'Isi Pesan',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _messageCtrl,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'Tulis pesan pengumuman lengkap di sini...',
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'Isi pesan wajib diisi';
                    return null;
                  },
                ),
                const SizedBox(height: 28),
                PrimaryButton(
                  text: 'Siarkan Pengumuman 🚀',
                  color: const Color(0xFF8B1F1F),
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
