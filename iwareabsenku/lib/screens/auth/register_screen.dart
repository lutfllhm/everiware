import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';
import 'otp_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    HapticFeedback.lightImpact();
    final auth = context.read<AuthProvider>();
    try {
      final data = await auth.register(
        _nameCtrl.text.trim(),
        _emailCtrl.text.trim(),
        _passCtrl.text,
        _phoneCtrl.text.trim(),
      );
      if (!mounted) return;
      if (data['success'] == true) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => OtpScreen(userId: data['userId'])),
        );
      } else {
        _showError(data['message'] ?? 'Registrasi gagal');
      }
    } catch (e) {
      _showError('Tidak bisa terhubung ke server');
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppColors.grey900,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Buat Akun Baru'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Isi data diri kamu', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.3)),
            const SizedBox(height: 4),
            const Text('Semua field wajib diisi', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
            const SizedBox(height: 24),

            _FormField(
              label: 'Nama Lengkap',
              child: TextFormField(
                controller: _nameCtrl,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  hintText: 'Nama sesuai KTP',
                  prefixIcon: Icon(Icons.person_outline, size: 18),
                ),
                validator: (v) => v!.isEmpty ? 'Nama wajib diisi' : null,
              ),
            ),
            const SizedBox(height: 14),

            _FormField(
              label: 'Email',
              child: TextFormField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  hintText: 'nama@gmail.com',
                  prefixIcon: Icon(Icons.email_outlined, size: 18),
                ),
                validator: (v) => v!.isEmpty ? 'Email wajib diisi' : !v.contains('@') ? 'Email tidak valid' : null,
              ),
            ),
            const SizedBox(height: 14),

            _FormField(
              label: 'Nomor WhatsApp',
              child: TextFormField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  hintText: '08xxxxxxxxxx',
                  prefixIcon: Icon(Icons.phone_outlined, size: 18),
                ),
                validator: (v) => v!.isEmpty ? 'Nomor WA wajib diisi' : null,
              ),
            ),
            const SizedBox(height: 14),

            _FormField(
              label: 'Password',
              child: TextFormField(
                controller: _passCtrl,
                obscureText: _obscure,
                decoration: InputDecoration(
                  hintText: 'Minimal 6 karakter',
                  prefixIcon: const Icon(Icons.lock_outline, size: 18),
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18, color: AppColors.textMuted),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                validator: (v) => v!.length < 6 ? 'Password minimal 6 karakter' : null,
              ),
            ),
            const SizedBox(height: 14),

            // Info box
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primaryBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primaryBorder),
              ),
              child: const Row(children: [
                Icon(Icons.info_outline, size: 15, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Kode OTP akan dikirim ke email kamu untuk verifikasi',
                    style: TextStyle(fontSize: 12, color: AppColors.primary),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 24),

            PrimaryButton(
              text: 'Daftar Sekarang',
              onPressed: _register,
              isLoading: auth.isLoading,
              icon: Icons.person_add_rounded,
            ),
          ]),
        ),
      ),
    );
  }
}

class _FormField extends StatelessWidget {
  final String label;
  final Widget child;
  const _FormField({required this.label, required this.child});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
      const SizedBox(height: 6),
      child,
    ],
  );
}
