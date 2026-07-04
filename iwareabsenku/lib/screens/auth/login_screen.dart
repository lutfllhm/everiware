import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../services/biometric_service.dart';
import '../../utils/app_theme.dart';
import 'otp_screen.dart';
import 'forgot_password_screen.dart';
import 'welcome_screen.dart';

import 'package:shared_preferences/shared_preferences.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final available = await BiometricService().isAvailable();
    final enabled   = await BiometricService().isEnabled();
    if (mounted) setState(() { _biometricAvailable = available; _biometricEnabled = enabled; });
    if (available && enabled) {
      Future.delayed(const Duration(milliseconds: 700), _loginWithBiometric);
    }
  }

  Future<void> _loginWithBiometric() async {
    final enabled = await BiometricService().isEnabled();
    if (!enabled || !mounted) return;
    final result = await BiometricService().authenticateWithResult(reason: 'Masuk ke EVERIWARE');
    if (!mounted) return;
    if (!result.success) {
      if (result.errorCode != null) _showError(result.errorMessage ?? 'Autentikasi biometrik gagal');
      return;
    }
    final creds = await BiometricService().getCredentials();
    if (creds == null || !mounted) {
      _showError('Data login biometrik tidak ditemukan. Silakan login manual.');
      return;
    }
    final auth = context.read<AuthProvider>();
    final data = await auth.login(creds['email']!, creds['password']!);
    if (!mounted) return;
    if (data['success'] == true) {
      Navigator.pushReplacementNamed(context, auth.isAdmin ? '/admin' : '/home');
    } else {
      _showError('Biometrik gagal: ${data['message']}');
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    HapticFeedback.lightImpact();
    final auth = context.read<AuthProvider>();
    try {
      final data = await auth.login(_emailCtrl.text.trim(), _passCtrl.text);
      if (!mounted) return;
      if (data['success'] == true) {
        if (data['needVerify'] == true) {
          Navigator.push(context, MaterialPageRoute(builder: (_) => OtpScreen(userId: data['userId'])));
        } else {
          // Temporarily cache the password in SharedPreferences for biometric activation after FaceID registration
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('temp_login_pass', _passCtrl.text);
          } catch (_) {}

          if (_biometricAvailable && !_biometricEnabled) {
            await _offerBiometric(_emailCtrl.text.trim(), _passCtrl.text);
          }
          if (mounted) {
            Navigator.pushReplacementNamed(context, auth.isAdmin ? '/admin' : '/home');
          }
        }
      } else {
        _showError(data['message'] ?? 'Login gagal');
      }
    } catch (e) {
      _showError('Tidak bisa terhubung ke server.');
    }
  }

  Future<void> _offerBiometric(String email, String password) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Aktifkan Login Biometrik?', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: const Text('Gunakan sidik jari atau wajah untuk login lebih cepat di lain waktu.',
            style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Nanti saja')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6B0E11),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Aktifkan'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      final enabled = await BiometricService().enable(email, password);
      if (mounted && enabled) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Login biometrik berhasil diaktifkan'),
          backgroundColor: Colors.green,
        ));
      }
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: Colors.redAccent,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Container(
        height: screenHeight,
        width: screenWidth,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(0xFF6B0E11), // Top deep red
              Color(0xFF380507), // Mid dark red
              Color(0xFF160102), // Bottom almost black-red
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Stack(
          children: [
            // Background waves/curves pattern
            Positioned.fill(
              child: CustomPaint(
                painter: BackgroundCurvesPainter(),
              ),
            ),

            // Form Content
            SafeArea(
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 28.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      SizedBox(height: screenHeight * 0.05),

                      // Circular Logo
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.2),
                              blurRadius: 15,
                              offset: const Offset(0, 5),
                            )
                          ],
                        ),
                        child: ClipOval(
                          child: Image.asset(
                            'assets/images/logo.png',
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Brand Text
                      const Text(
                        'EVERIWARE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 25,
                          fontWeight: FontWeight.w900,
                          fontStyle: FontStyle.italic,
                          letterSpacing: 3.0,
                          fontFamily: 'Usuzi',
                          shadows: [
                            Shadow(
                              color: Colors.black38,
                              offset: Offset(0, 2),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                      ),
                      SizedBox(height: screenHeight * 0.04),

                      // Form Title Header
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Masuk ke Akun',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'jangan bagikan info login kamu ke siapapun.',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.5),
                                fontSize: 12,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 28),

                      // Form fields
                      Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            // Email/Username Field
                            TextFormField(
                              controller: _emailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              style: const TextStyle(color: Colors.white, fontSize: 15),
                              decoration: InputDecoration(
                                hintText: 'Username atau Email',
                                hintStyle: TextStyle(
                                  color: Colors.white.withOpacity(0.35),
                                  fontSize: 14,
                                ),
                                prefixIcon: Icon(
                                  Icons.person_outline_rounded,
                                  color: Colors.white.withOpacity(0.5),
                                ),
                                filled: true,
                                fillColor: Colors.white.withOpacity(0.06),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: BorderSide(
                                    color: Colors.white.withOpacity(0.12),
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: BorderSide(
                                    color: Colors.white.withOpacity(0.08),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Color(0xFFEF5350),
                                    width: 1.5,
                                  ),
                                ),
                                errorBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Colors.redAccent,
                                    width: 1,
                                  ),
                                ),
                                focusedErrorBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Colors.redAccent,
                                    width: 1.5,
                                  ),
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 16,
                                ),
                              ),
                              validator: (v) => v!.isEmpty ? 'Email wajib diisi' : null,
                            ),
                            const SizedBox(height: 16),

                            // Password Field
                            TextFormField(
                              controller: _passCtrl,
                              obscureText: _obscure,
                              style: const TextStyle(color: Colors.white, fontSize: 15),
                              decoration: InputDecoration(
                                hintText: 'Password',
                                hintStyle: TextStyle(
                                  color: Colors.white.withOpacity(0.35),
                                  fontSize: 14,
                                ),
                                prefixIcon: Icon(
                                  Icons.lock_outline_rounded,
                                  color: Colors.white.withOpacity(0.5),
                                ),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscure
                                        ? Icons.visibility_off_outlined
                                        : Icons.visibility_outlined,
                                    color: Colors.white.withOpacity(0.5),
                                    size: 20,
                                  ),
                                  onPressed: () => setState(() => _obscure = !_obscure),
                                ),
                                filled: true,
                                fillColor: Colors.white.withOpacity(0.06),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: BorderSide(
                                    color: Colors.white.withOpacity(0.12),
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: BorderSide(
                                    color: Colors.white.withOpacity(0.08),
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Color(0xFFEF5350),
                                    width: 1.5,
                                  ),
                                ),
                                errorBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Colors.redAccent,
                                    width: 1,
                                  ),
                                ),
                                focusedErrorBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(
                                    color: Colors.redAccent,
                                    width: 1.5,
                                  ),
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 16,
                                ),
                              ),
                              validator: (v) => v!.isEmpty ? 'Password wajib diisi' : null,
                            ),
                          ],
                        ),
                      ),
                      
                      // Lupa Password link
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ForgotPasswordScreen())),
                          child: const Text('Lupa password?',
                              style: TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600)),
                        ),
                      ),

                      const SizedBox(height: 8),

                      // White Solid Login Button
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: auth.isLoading ? null : _login,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF5C0A0B),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            elevation: 0,
                          ),
                          child: auth.isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    color: Color(0xFF5C0A0B),
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : const Text(
                                  'Masuk',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF5C0A0B),
                                    letterSpacing: 0.3,
                                  ),
                                ),
                        ),
                      ),

                      // Biometric Login Section
                      if (_biometricAvailable && _biometricEnabled) ...[
                        const SizedBox(height: 20),
                        Row(children: [
                          Expanded(child: Divider(color: Colors.white.withOpacity(0.15))),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text('atau', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12)),
                          ),
                          Expanded(child: Divider(color: Colors.white.withOpacity(0.15))),
                        ]),
                        const SizedBox(height: 20),
                        GestureDetector(
                          onTap: _loginWithBiometric,
                          child: Container(
                            width: double.infinity,
                            height: 48,
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.06),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.white.withOpacity(0.12)),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.fingerprint_rounded, color: Colors.white, size: 22),
                                SizedBox(width: 8),
                                Text('Masuk dengan Biometrik',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
                              ],
                            ),
                          ),
                        ),
                      ],

                      const SizedBox(height: 24),

                      // Belum punya akun
                      Text(
                        'Belum punya akun? Silakan hubungi HRD. Terima kasih.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                      ),
                      const SizedBox(height: 16),

                      // Info & Kebijakan Link
                      GestureDetector(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const WelcomeScreen(isReadOnly: true),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.info_outline_rounded,
                              size: 14,
                              color: Colors.white.withOpacity(0.5),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Info Aplikasi & Ketentuan',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.5),
                                decoration: TextDecoration.underline,
                                decorationColor: Colors.white.withOpacity(0.4),
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BackgroundCurvesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Wave 1: Soft broad fill shape at bottom-left
    final paint1 = Paint()
      ..color = Colors.white.withOpacity(0.025)
      ..style = PaintingStyle.fill;

    final path1 = Path();
    path1.moveTo(0, size.height * 0.45);
    path1.quadraticBezierTo(
      size.width * 0.45,
      size.height * 0.52,
      size.width * 0.32,
      size.height * 0.82,
    );
    path1.quadraticBezierTo(
      size.width * 0.22,
      size.height * 0.95,
      0,
      size.height * 0.92,
    );
    path1.close();
    canvas.drawPath(path1, paint1);

    // Wave 2: Sweeping curved border stroke across screen
    final paintStroke = Paint()
      ..color = Colors.white.withOpacity(0.015)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 35;

    final path2 = Path();
    path2.moveTo(size.width, size.height * 0.25);
    path2.cubicTo(
      size.width * 0.45,
      size.height * 0.42,
      size.width * 0.15,
      size.height * 0.68,
      size.width * 0.85,
      size.height * 0.92,
    );
    canvas.drawPath(path2, paintStroke);

    // Wave 3: Small outline arc bottom right
    final paintStroke2 = Paint()
      ..color = Colors.white.withOpacity(0.01)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 15;

    final path3 = Path();
    path3.moveTo(size.width * 0.4, size.height);
    path3.quadraticBezierTo(
      size.width * 0.7,
      size.height * 0.85,
      size.width,
      size.height * 0.9,
    );
    canvas.drawPath(path3, paintStroke2);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
