import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/auth_provider.dart';
import '../../services/biometric_service.dart';
import '../../services/api_service.dart';
import '../../models/user_model.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import 'employee_directory_screen.dart';
import 'locations_screen.dart';
import 'broadcast_screen.dart';

class AdminProfileTab extends StatefulWidget {
  const AdminProfileTab({super.key});

  @override
  State<AdminProfileTab> createState() => _AdminProfileTabState();
}

class _AdminProfileTabState extends State<AdminProfileTab> {
  bool _editMode = false;
  bool _passMode = false;
  bool _loading = false;
  bool _avatarLoading = false;
  bool _obscureOld = true;
  bool _obscureNew = true;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;

  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _oldPassCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameCtrl.text = user?.name ?? '';
    _phoneCtrl.text = user?.phone ?? '';
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final available = await BiometricService().isAvailable();
    final enabled   = await BiometricService().isEnabled();
    if (mounted) {
      setState(() {
        _biometricAvailable = available;
        _biometricEnabled = enabled;
      });
    }
  }

  Future<void> _toggleBiometric(bool value) async {
    if (value) {
      final passCtrl = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Aktifkan Login Biometrik',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Masukkan password kamu untuk mengaktifkan login biometrik.',
                style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
            const SizedBox(height: 16),
            TextField(
              controller: passCtrl,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Password',
                border: OutlineInputBorder(),
              ),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false),
                child: const Text('Batal')),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Aktifkan'),
            ),
          ],
        ),
      );
      if (ok != true || !mounted) return;
      final user = context.read<AuthProvider>().user;
      final enabled = await BiometricService().enable(user?.email ?? '', passCtrl.text);
      if (mounted) {
        setState(() => _biometricEnabled = enabled);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(enabled ? 'Login biometrik diaktifkan ✅' : 'Gagal mengaktifkan biometrik'),
          backgroundColor: enabled ? AppColors.teal : AppColors.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ));
      }
    } else {
      await BiometricService().disable();
      if (mounted) setState(() => _biometricEnabled = false);
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _oldPassCtrl.dispose();
    _newPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadAvatar() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const SizedBox(height: 12),
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 20),
            const Text('Pilih Foto Profil',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.textPrimary)),
            const SizedBox(height: 16),
            ListTile(
              leading: Container(
                width: 42, height: 42,
                decoration: BoxDecoration(color: AppColors.primaryBg, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.camera_alt_rounded, color: AppColors.primary, size: 20),
              ),
              title: const Text('Ambil Foto', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Gunakan kamera', style: TextStyle(fontSize: 12)),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: Container(
                width: 42, height: 42,
                decoration: BoxDecoration(color: AppColors.primaryBg, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.photo_library_rounded, color: AppColors.primary, size: 20),
              ),
              title: const Text('Pilih dari Galeri', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Dari penyimpanan', style: TextStyle(fontSize: 12)),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
            const SizedBox(height: 16),
          ]),
        ),
      ),
    );

    if (source == null) return;

    final img = await picker.pickImage(source: source, imageQuality: 80, maxWidth: 800);
    if (img == null) return;
    if (!mounted) return;

    setState(() => _avatarLoading = true);
    try {
      final file = File(img.path);
      final data = await ApiService().updateAvatar(file, _nameCtrl.text, _phoneCtrl.text);
      if (!mounted) return;
      if (data['success'] == true) {
        if (data['user'] != null) {
          final updatedUser = UserModel.fromJson(data['user']);
          context.read<AuthProvider>().updateUser(updatedUser);
        }
        _snack('Foto profil berhasil diperbarui ✓');
      } else {
        _snack(data['message'] ?? 'Gagal upload foto', error: true);
      }
    } catch (e) {
      if (!mounted) return;
      _snack('Gagal mengupload foto', error: true);
    } finally {
      if (mounted) setState(() => _avatarLoading = false);
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        Icon(
          error ? Icons.error_rounded : Icons.check_circle_rounded,
          color: Colors.white,
          size: 18,
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(msg, style: const TextStyle(fontWeight: FontWeight.w500))),
      ]),
      backgroundColor: error ? AppColors.danger : AppColors.teal,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 3),
    ));
  }

  Future<void> _save() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().updateProfile(_nameCtrl.text, _phoneCtrl.text);
      if (!mounted) return;
      if (data['success'] == true) {
        if (data['user'] != null) {
          context.read<AuthProvider>().updateUser(UserModel.fromJson(data['user']));
        }
        _snack('Profil berhasil diperbarui');
        setState(() => _editMode = false);
      } else {
        _snack(data['message'] ?? 'Gagal memperbarui profil', error: true);
      }
    } catch (_) {
      if (!mounted) return;
      _snack('Gagal memperbarui profil', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changePass() async {
    if (_newPassCtrl.text.length < 6) {
      _snack('Password minimal 6 karakter', error: true);
      return;
    }
    setState(() => _loading = true);
    try {
      final data = await ApiService().changePassword(_oldPassCtrl.text, _newPassCtrl.text);
      if (!mounted) return;
      if (data['success'] == true) {
        _snack('Password berhasil diubah');
        setState(() => _passMode = false);
        _oldPassCtrl.clear();
        _newPassCtrl.clear();
      } else {
        _snack(data['message'] ?? 'Gagal mengubah password', error: true);
      }
    } catch (_) {
      if (!mounted) return;
      _snack('Gagal mengubah password', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    HapticFeedback.mediumImpact();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4,
              decoration: BoxDecoration(color: AppColors.grey300, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 24),
          Container(
            width: 64, height: 64,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.danger.withValues(alpha: 0.30),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Icon(Icons.logout_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(height: 18),
          const Text('Keluar dari Akun?',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          const Text(
            'Kamu perlu login ulang setelah keluar dari aplikasi.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),
          Row(children: [
            Expanded(child: SecondaryButton(text: 'Batal', onPressed: () => Navigator.pop(context, false))),
            const SizedBox(width: 12),
            Expanded(
              child: SizedBox(
                height: 52,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.danger.withValues(alpha: 0.30),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Keluar', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ),
              ),
            ),
          ]),
        ]),
      ));
    if (ok == true && mounted) {
      await context.read<AuthProvider>().logout();
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F8FD),
        body: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: ProfileHeader(
                title: 'Informasi Akun Admin',
                name: user?.name ?? '',
                position: user?.position ?? user?.roleLabel ?? '',
                department: user?.department ?? '',
                avatarFilename: user?.avatar,
                onAvatarTap: _pickAndUploadAvatar,
                avatarLoading: _avatarLoading,
                showCameraIcon: true,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _buildInfoCard(user),
                  const SizedBox(height: 12),
                  _SettingsSection(
                    title: 'FITUR & LAYANAN ADMIN',
                    children: [
                      _buildDirectoryRow(isLast: false),
                      _buildGeofenceRow(isLast: false),
                      _buildBroadcastRow(isLast: true),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _SettingsSection(
                    title: 'KEAMANAN & AKSES',
                    children: [
                      if (_biometricAvailable)
                        _buildBiometricRow(isLast: false),
                      _buildPasswordRow(isLast: true),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildLogoutCard(),
                  const SizedBox(height: 24),
                  Center(
                    child: Column(children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.dangerBg,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
                        ),
                        child: const Text('EVERIWARE v1.0.0',
                            style: TextStyle(color: AppColors.danger, fontSize: 12,
                                fontWeight: FontWeight.w600)),
                      ),
                      const SizedBox(height: 6),
                      const Text('© 2026 CV. Rajawali Bina Maju',
                          style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                    ]),
                  ),
                  const SizedBox(height: 100),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard(UserModel? user) => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFEEEEEE), width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 16, 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Informasi Pribadi',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                  ),
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      setState(() => _editMode = !_editMode);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      decoration: BoxDecoration(
                        color: _editMode ? const Color(0xFFFEF2F2) : const Color(0xFFF5F0F0),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: _editMode ? const Color(0xFFFECACA) : const Color(0xFFE0D5D5),
                        ),
                      ),
                      child: Text(
                        _editMode ? 'Batal' : 'Edit',
                        style: TextStyle(
                          color: _editMode ? const Color(0xFFDC2626) : const Color(0xFF8B1F1F),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.divider),
            if (_editMode) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                child: Column(children: [
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Nama Lengkap',
                      prefixIcon: Icon(Icons.person_outline, size: 18),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Nomor WhatsApp',
                      prefixIcon: Icon(Icons.phone_outlined, size: 18),
                    ),
                  ),
                  const SizedBox(height: 20),
                  PrimaryButton(text: 'Simpan Perubahan', onPressed: _save, isLoading: _loading),
                ]),
              ),
            ] else ...[
              _NewInfoRow(
                icon: Icons.badge_outlined,
                label: 'ID Admin (NIP)',
                value: user?.employeeId ?? '-',
              ),
              _NewInfoRow(
                icon: Icons.person_outline_rounded,
                label: 'Nama Lengkap',
                value: user?.name ?? '-',
              ),
              _NewInfoRow(
                icon: Icons.work_outline_rounded,
                label: 'Jabatan / Role',
                value: user?.position ?? user?.roleLabel ?? '-',
              ),
              _NewInfoRow(
                icon: Icons.group_outlined,
                label: 'Divisi / Departemen',
                value: user?.department ?? '-',
              ),
              _NewInfoRow(
                icon: Icons.phone_outlined,
                label: 'No. Telp / WhatsApp',
                value: user?.phone ?? '-',
              ),
              _NewInfoRow(
                icon: Icons.email_outlined,
                label: 'Email',
                value: user?.email ?? '-',
                isLast: true,
              ),
            ],
          ]),
        ),
      );

  Widget _buildDirectoryRow({bool isLast = false}) => _SettingsRow(
        icon: Icons.people_alt_rounded,
        iconColor: const Color(0xFF8B1F1F),
        iconBgColor: const Color(0xFFF5F0F0),
        title: 'Daftar Karyawan',
        subtitle: 'Lihat data, kontak & divisi karyawan',
        isLast: isLast,
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const EmployeeDirectoryScreen()),
          );
        },
      );

  Widget _buildGeofenceRow({bool isLast = false}) => _SettingsRow(
        icon: Icons.map_rounded,
        iconColor: const Color(0xFF8B1F1F),
        iconBgColor: const Color(0xFFF5F0F0),
        title: 'Area Geofence',
        subtitle: 'Kelola radius lokasi absensi kantor',
        isLast: isLast,
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const LocationsScreen()),
          );
        },
      );

  Widget _buildBroadcastRow({bool isLast = false}) => _SettingsRow(
        icon: Icons.campaign_rounded,
        iconColor: const Color(0xFF8B1F1F),
        iconBgColor: const Color(0xFFF5F0F0),
        title: 'Kirim Siaran',
        subtitle: 'Kirim notifikasi push pengumuman ke karyawan',
        isLast: isLast,
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const BroadcastScreen()),
          );
        },
      );

  Widget _buildPasswordRow({bool isLast = false}) => _SettingsRow(
        icon: Icons.lock_outline_rounded,
        iconColor: const Color(0xFF8B1F1F),
        iconBgColor: const Color(0xFFF5F0F0),
        title: 'Ubah Password',
        subtitle: 'Ganti password akun kamu',
        isLast: isLast,
        onTap: () {
          HapticFeedback.lightImpact();
          setState(() => _passMode = !_passMode);
        },
        trailing: AnimatedRotation(
          turns: _passMode ? 0.5 : 0,
          duration: const Duration(milliseconds: 250),
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textMuted, size: 18),
          ),
        ),
        expandedContent: AnimatedSize(
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeInOut,
          child: _passMode
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                  child: Column(
                    children: [
                      const Divider(color: AppColors.divider),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _oldPassCtrl,
                        obscureText: _obscureOld,
                        decoration: InputDecoration(
                          labelText: 'Password Lama',
                          prefixIcon: const Icon(Icons.lock_outline, size: 18),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscureOld ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                              size: 18,
                              color: AppColors.textMuted,
                            ),
                            onPressed: () => setState(() => _obscureOld = !_obscureOld),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _newPassCtrl,
                        obscureText: _obscureNew,
                        decoration: InputDecoration(
                          labelText: 'Password Baru (min. 6 karakter)',
                          prefixIcon: const Icon(Icons.lock_reset_outlined, size: 18),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscureNew ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                              size: 18,
                              color: AppColors.textMuted,
                            ),
                            onPressed: () => setState(() => _obscureNew = !_obscureNew),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: SecondaryButton(
                              text: 'Batal',
                              onPressed: () => setState(() => _passMode = false),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: PrimaryButton(
                              text: 'Simpan',
                              onPressed: _changePass,
                              isLoading: _loading,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                )
              : const SizedBox.shrink(),
        ),
      );

  Widget _buildBiometricRow({bool isLast = false}) => _SettingsRow(
        icon: Icons.fingerprint_rounded,
        iconColor: const Color(0xFF8B1F1F),
        iconBgColor: const Color(0xFFF5F0F0),
        title: 'Login Biometrik',
        subtitle: _biometricEnabled ? 'Aktif — sidik jari / wajah' : 'Nonaktif',
        isLast: isLast,
        onTap: () {
          HapticFeedback.lightImpact();
          _toggleBiometric(!_biometricEnabled);
        },
        trailing: Switch(
          value: _biometricEnabled,
          onChanged: _toggleBiometric,
          activeThumbColor: const Color(0xFF8B1F1F),
          activeTrackColor: const Color(0xFFF5F0F0),
        ),
      );

  Widget _buildLogoutCard() => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFEEEEEE), width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: _SettingsRow(
            icon: Icons.logout_rounded,
            iconColor: const Color(0xFFDC2626),
            iconBgColor: const Color(0xFFFEF2F2),
            title: 'Keluar dari Akun',
            subtitle: 'Sesi login akan diakhiri',
            titleColor: const Color(0xFFDC2626),
            onTap: _logout,
            isLast: true,
            trailing: const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFFDC2626),
              size: 20,
            ),
          ),
        ),
      );
}

class _NewInfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool isLast;

  const _NewInfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 38, height: 38,
              decoration: BoxDecoration(
                color: const Color(0xFFF5F0F0),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: const Color(0xFF8B1F1F)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      if (!isLast)
        const Divider(height: 1, indent: 70, endIndent: 18, color: AppColors.divider),
    ],
  );
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SettingsSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8, top: 12),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
              letterSpacing: 0.8,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFEEEEEE), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: Column(
              children: children,
            ),
          ),
        ),
      ],
    );
  }
}

class _SettingsRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final Widget? expandedContent;
  final Color? titleColor;
  final bool isLast;

  const _SettingsRow({
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.title,
    required this.subtitle,
    this.onTap,
    this.trailing,
    this.expandedContent,
    this.titleColor,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: iconBgColor,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: iconColor, size: 18),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: titleColor ?? AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (trailing != null)
                    trailing!
                  else
                    Icon(
                      Icons.chevron_right_rounded,
                      color: titleColor?.withValues(alpha: 0.5) ?? AppColors.textMuted,
                      size: 20,
                    ),
                ],
              ),
            ),
          ),
        ),
        if (expandedContent != null) expandedContent!,
        if (!isLast)
          const Divider(
            height: 1,
            indent: 70,
            endIndent: 18,
            color: AppColors.divider,
          ),
      ],
    );
  }
}
