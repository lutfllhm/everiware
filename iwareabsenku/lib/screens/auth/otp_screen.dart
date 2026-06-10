import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';

class OtpScreen extends StatefulWidget {
  final String userId;
  const OtpScreen({super.key, required this.userId});
  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  bool _loading = false;

  // Countdown timer
  int _countdown = 60;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _startCountdown() {
    _countdown = 60;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        if (_countdown > 0) {
          _countdown--;
        } else {
          t.cancel();
        }
      });
    });
  }

  String get _otp => _controllers.map((c) => c.text).join();

  Future<void> _verify() async {
    if (_otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Masukkan 6 digit kode OTP'),
        backgroundColor: AppColors.primary,
      ));
      return;
    }
    setState(() => _loading = true);
    try {
      final auth = context.read<AuthProvider>();
      final data = await auth.verifyOTP(widget.userId, _otp);
      if (!mounted) return;
      if (data['success'] == true) {
        Navigator.pushReplacementNamed(
            context, auth.isAdmin ? '/admin' : '/home');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(data['message'] ?? 'OTP salah'),
          backgroundColor: AppColors.primary,
        ));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Gagal verifikasi'),
        backgroundColor: AppColors.primary,
      ));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    if (_countdown > 0) return;
    try {
      await ApiService().resendOTP(widget.userId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Kode OTP baru telah dikirim'),
        backgroundColor: AppColors.teal,
      ));
      for (var c in _controllers) {
        c.clear();
      }
      _focusNodes[0].requestFocus();
      _startCountdown();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Gagal mengirim ulang kode'),
          backgroundColor: AppColors.primary,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verifikasi OTP')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          const SizedBox(height: 20),
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primaryBg,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.mark_email_read_outlined,
                size: 36, color: AppColors.primary),
          ),
          const SizedBox(height: 20),
          const Text('Cek email kamu  -  - ',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text(
            'Masukkan 6 digit kode yang dikirim ke email kamu',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 36),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(
              6,
              (i) => SizedBox(
                width: 48,
                height: 56,
                child: TextFormField(
                  controller: _controllers[i],
                  focusNode: _focusNodes[i],
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  maxLength: 1,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                  decoration: InputDecoration(
                    counterText: '',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          const BorderSide(color: AppColors.primary, width: 2),
                    ),
                  ),
                  onChanged: (v) {
                    if (v.isNotEmpty && i < 5) _focusNodes[i + 1].requestFocus();
                    if (v.isEmpty && i > 0) _focusNodes[i - 1].requestFocus();
                  },
                ),
              ),
            ),
          ),
          const SizedBox(height: 32),
          GradientButton(
            text: 'Verifikasi',
            onPressed: _verify,
            isLoading: _loading,
          ),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: _countdown == 0 ? _resend : null,
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: Text(_countdown > 0
                ? 'Kirim ulang (${_countdown}d)'
                : 'Kirim ulang kode OTP'),
            style: TextButton.styleFrom(
              foregroundColor: _countdown == 0 ? AppColors.primary : AppColors.textMuted,
            ),
          ),
        ]),
      ),
    );
  }
}

