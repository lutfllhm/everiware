import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with SingleTickerProviderStateMixin {
  // Steps: email → otp → newPassword
  int _step = 0;
  bool _loading = false;

  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool _obscure = true;

  String? _userId;
  String? _resetToken;
  final List<TextEditingController> _otpCtrls =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocus = List.generate(6, (_) => FocusNode());

  late final AnimationController _animCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    for (final c in _otpCtrls) c.dispose();
    for (final f in _otpFocus) f.dispose();
    super.dispose();
  }

  void _nextStep() {
    _animCtrl.reset();
    setState(() => _step++);
    _animCtrl.forward();
  }

  void _showSnack(String msg, {bool error = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? AppColors.danger : AppColors.teal,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.all(16),
    ));
  }

  Future<void> _sendOTP() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) return _showSnack('Email wajib diisi');
    setState(() => _loading = true);
    try {
      final data = await ApiService().forgotPassword(email);
      if (data['userId'] != null) {
        _userId = data['userId'];
        _nextStep();
        _showSnack(data['message'] ?? 'Kode dikirim ke email', error: false);
      } else {
        _showSnack(data['message'] ?? 'Gagal mengirim kode');
      }
    } catch (_) {
      _showSnack('Tidak bisa terhubung ke server');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyOTP() async {
    final otp = _otpCtrls.map((c) => c.text).join();
    if (otp.length != 6) return _showSnack('Masukkan 6 digit kode OTP');
    setState(() => _loading = true);
    try {
      final data = await ApiService().verifyResetOTP(_userId!, otp);
      if (data['success'] == true) {
        _resetToken = data['resetToken'];
        _nextStep();
      } else {
        _showSnack(data['message'] ?? 'Kode OTP salah');
      }
    } catch (_) {
      _showSnack('Tidak bisa terhubung ke server');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resetPassword() async {
    final pass = _passCtrl.text;
    if (pass.length < 6) return _showSnack('Password minimal 6 karakter');
    setState(() => _loading = true);
    try {
      final data = await ApiService().resetPassword(_userId!, _resetToken!, pass);
      if (data['success'] == true) {
        _showSnack(data['message'] ?? 'Password berhasil direset!', error: false);
        await Future.delayed(const Duration(milliseconds: 1200));
        if (mounted) Navigator.pop(context);
      } else {
        _showSnack(data['message'] ?? 'Gagal reset password');
      }
    } catch (_) {
      _showSnack('Tidak bisa terhubung ke server');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final safePad = MediaQuery.of(context).padding;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
              child: Row(children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                  color: AppColors.textPrimary,
                  onPressed: () => Navigator.pop(context),
                ),
                const Spacer(),
                // Step indicator
                Row(children: List.generate(3, (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.only(left: 6),
                  width: _step == i ? 24 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _step >= i ? AppColors.primary : AppColors.grey200,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ))),
              ]),
            ),

            Expanded(
              child: FadeTransition(
                opacity: _fadeAnim,
                child: SingleChildScrollView(
                  padding: EdgeInsets.fromLTRB(28, 24, 28, safePad.bottom + 24),
                  child: _step == 0
                      ? _buildEmailStep()
                      : _step == 1
                          ? _buildOTPStep()
                          : _buildNewPasswordStep(),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  // ── Step 1: Email ─────────────────────────────────────────────────────────
  Widget _buildEmailStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        width: 56, height: 56,
        decoration: BoxDecoration(
          color: AppColors.dangerBg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.lock_reset_rounded, color: AppColors.danger, size: 28),
      ),
      const SizedBox(height: 20),
      Text('Lupa Password?',
          style: GoogleFonts.poppins(fontSize: 26, fontWeight: FontWeight.w800,
              color: AppColors.textPrimary, letterSpacing: -0.5)),
      const SizedBox(height: 8),
      Text('Masukkan email yang terdaftar. Kami akan mengirimkan kode verifikasi.',
          style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textMuted, height: 1.5)),
      const SizedBox(height: 32),
      _label('Alamat Email'),
      const SizedBox(height: 8),
      TextFormField(
        controller: _emailCtrl,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.done,
        onFieldSubmitted: (_) => _sendOTP(),
        style: GoogleFonts.poppins(fontSize: 14, color: AppColors.textPrimary),
        decoration: _inputDeco('nama@email.com', Icons.email_outlined),
      ),
      const SizedBox(height: 28),
      _primaryButton('Kirim Kode Reset', _sendOTP),
    ]);
  }

  // ── Step 2: OTP ───────────────────────────────────────────────────────────
  Widget _buildOTPStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        width: 56, height: 56,
        decoration: BoxDecoration(
          color: AppColors.primaryBg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.mark_email_read_rounded, color: AppColors.primary, size: 28),
      ),
      const SizedBox(height: 20),
      Text('Cek Email Kamu',
          style: GoogleFonts.poppins(fontSize: 26, fontWeight: FontWeight.w800,
              color: AppColors.textPrimary, letterSpacing: -0.5)),
      const SizedBox(height: 8),
      RichText(text: TextSpan(
        style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textMuted, height: 1.5),
        children: [
          const TextSpan(text: 'Kode 6 digit sudah dikirim ke '),
          TextSpan(text: _emailCtrl.text,
              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
          const TextSpan(text: '. Berlaku 10 menit.'),
        ],
      )),
      const SizedBox(height: 32),
      // OTP boxes
      Row(children: List.generate(6, (i) => Expanded(
        child: Padding(
          padding: EdgeInsets.only(left: i == 0 ? 0 : 8),
          child: TextFormField(
            controller: _otpCtrls[i],
            focusNode: _otpFocus[i],
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 1,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w800,
                color: AppColors.textPrimary),
            decoration: InputDecoration(
              counterText: '',
              filled: true,
              fillColor: AppColors.grey50,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.border, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.primary, width: 2),
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 16),
            ),
            onChanged: (val) {
              if (val.isNotEmpty && i < 5) {
                _otpFocus[i + 1].requestFocus();
              } else if (val.isEmpty && i > 0) {
                _otpFocus[i - 1].requestFocus();
              }
            },
          ),
        ),
      ))),
      const SizedBox(height: 28),
      _primaryButton('Verifikasi Kode', _verifyOTP),
      const SizedBox(height: 16),
      Center(
        child: TextButton(
          onPressed: _loading ? null : () {
            for (final c in _otpCtrls) c.clear();
            _otpFocus[0].requestFocus();
            _sendOTP();
          },
          child: Text('Kirim ulang kode',
              style: GoogleFonts.poppins(fontSize: 13, color: AppColors.primary,
                  fontWeight: FontWeight.w600)),
        ),
      ),
    ]);
  }

  // ── Step 3: Password Baru ─────────────────────────────────────────────────
  Widget _buildNewPasswordStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        width: 56, height: 56,
        decoration: BoxDecoration(
          color: AppColors.teal50,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.lock_open_rounded, color: AppColors.teal, size: 28),
      ),
      const SizedBox(height: 20),
      Text('Buat Password Baru',
          style: GoogleFonts.poppins(fontSize: 26, fontWeight: FontWeight.w800,
              color: AppColors.textPrimary, letterSpacing: -0.5)),
      const SizedBox(height: 8),
      Text('Masukkan password baru kamu. Minimal 6 karakter.',
          style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textMuted, height: 1.5)),
      const SizedBox(height: 32),
      _label('Password Baru'),
      const SizedBox(height: 8),
      TextFormField(
        controller: _passCtrl,
        obscureText: _obscure,
        textInputAction: TextInputAction.done,
        onFieldSubmitted: (_) => _resetPassword(),
        style: GoogleFonts.poppins(fontSize: 14, color: AppColors.textPrimary),
        decoration: _inputDeco('Minimal 6 karakter', Icons.lock_outline_rounded).copyWith(
          suffixIcon: IconButton(
            icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                color: AppColors.textMuted, size: 20),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        ),
      ),
      const SizedBox(height: 28),
      _primaryButton('Simpan Password Baru', _resetPassword),
    ]);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  Widget _label(String text) => Text(text,
      style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600,
          color: AppColors.textSecondary));

  InputDecoration _inputDeco(String hint, IconData icon) => InputDecoration(
    hintText: hint,
    hintStyle: GoogleFonts.poppins(color: AppColors.textHint, fontSize: 14),
    filled: true,
    fillColor: AppColors.grey50,
    prefixIcon: Padding(
      padding: const EdgeInsets.all(12),
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          gradient: AppColors.primaryGradient,
          borderRadius: BorderRadius.circular(10),
          boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.25),
              blurRadius: 8, offset: const Offset(0, 3))],
        ),
        child: Icon(icon, color: Colors.white, size: 17),
      ),
    ),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.border, width: 1.5)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.primary, width: 2)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  );

  Widget _primaryButton(String label, VoidCallback onTap) => SizedBox(
    width: double.infinity,
    height: 56,
    child: DecoratedBox(
      decoration: BoxDecoration(
        gradient: _loading ? null : AppColors.primaryGradient,
        color: _loading ? AppColors.grey200 : null,
        borderRadius: BorderRadius.circular(18),
        boxShadow: _loading ? [] : [
          BoxShadow(color: AppColors.primary.withValues(alpha: 0.40),
              blurRadius: 20, offset: const Offset(0, 8)),
        ],
      ),
      child: ElevatedButton(
        onPressed: _loading ? null : onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
        child: _loading
            ? const SizedBox(width: 22, height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
            : Text(label, style: GoogleFonts.poppins(fontSize: 15,
                fontWeight: FontWeight.w700, letterSpacing: 0.2)),
      ),
    ),
  );
}
