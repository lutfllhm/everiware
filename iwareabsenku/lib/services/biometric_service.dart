import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'package:shared_preferences/shared_preferences.dart';

class BiometricService {
  static final BiometricService _instance = BiometricService._internal();
  factory BiometricService() => _instance;
  BiometricService._internal();

  final LocalAuthentication _auth = LocalAuthentication();

  static const _keyEnabled  = 'biometric_enabled';
  static const _keyEmail    = 'biometric_email';
  static const _keyPassword = 'biometric_password';

  /// Cek apakah perangkat mendukung biometrik
  Future<bool> isAvailable() async {
    try {
      final canCheck   = await _auth.canCheckBiometrics;
      final isSupported = await _auth.isDeviceSupported();
      return canCheck && isSupported;
    } catch (_) {
      return false;
    }
  }

  /// Cek apakah biometrik sudah diaktifkan user
  Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyEnabled) ?? false;
  }

  /// Simpan kredensial & aktifkan biometrik
  Future<bool> enable(String email, String password) async {
    try {
      final authenticated = await authenticate(
        reason: 'Konfirmasi identitas untuk mengaktifkan login biometrik',
      );
      if (!authenticated) return false;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_keyEnabled, true);
      await prefs.setString(_keyEmail, email);
      // Encode sederhana — hindari plain text di SharedPreferences
      await prefs.setString(_keyPassword, base64Encode(utf8.encode(password)));
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Nonaktifkan biometrik & hapus kredensial tersimpan
  Future<void> disable() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyEnabled);
    await prefs.remove(_keyEmail);
    await prefs.remove(_keyPassword);
  }

  /// Ambil kredensial tersimpan (hanya setelah autentikasi berhasil)
  Future<Map<String, String>?> getCredentials() async {
    final prefs    = await SharedPreferences.getInstance();
    final email    = prefs.getString(_keyEmail);
    final encoded  = prefs.getString(_keyPassword);
    if (email == null || encoded == null) return null;
    try {
      final password = utf8.decode(base64Decode(encoded));
      return {'email': email, 'password': password};
    } catch (_) {
      // Data korup — reset
      await disable();
      return null;
    }
  }

  /// Jalankan autentikasi biometrik
  /// Return [BiometricResult] dengan status dan pesan error jika gagal
  Future<BiometricResult> authenticateWithResult({
    String reason = 'Verifikasi identitas kamu',
  }) async {
    try {
      final success = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false, // izinkan PIN sebagai fallback
          stickyAuth: true,
        ),
      );
      return BiometricResult(success: success);
    } on PlatformException catch (e) {
      return BiometricResult(success: false, errorCode: e.code, errorMessage: _mapError(e.code));
    }
  }

  /// Versi sederhana — hanya return bool
  Future<bool> authenticate({String reason = 'Verifikasi identitas kamu'}) async {
    final result = await authenticateWithResult(reason: reason);
    return result.success;
  }

  /// Login dengan biometrik — return kredensial jika berhasil
  Future<Map<String, String>?> loginWithBiometric() async {
    final enabled = await isEnabled();
    if (!enabled) return null;
    final result = await authenticateWithResult(reason: 'Masuk ke IWA');
    if (!result.success) return null;
    return getCredentials();
  }

  String _mapError(String code) {
    switch (code) {
      case auth_error.notAvailable:
        return 'Biometrik tidak tersedia di perangkat ini';
      case auth_error.notEnrolled:
        return 'Belum ada sidik jari/wajah yang terdaftar di perangkat';
      case auth_error.lockedOut:
        return 'Terlalu banyak percobaan gagal. Coba lagi nanti';
      case auth_error.permanentlyLockedOut:
        return 'Biometrik dikunci permanen. Gunakan PIN perangkat';
      case auth_error.biometricOnlyNotSupported:
        return 'Mode biometrik saja tidak didukung';
      default:
        return 'Autentikasi biometrik gagal ($code)';
    }
  }
}

class BiometricResult {
  final bool success;
  final String? errorCode;
  final String? errorMessage;

  const BiometricResult({
    required this.success,
    this.errorCode,
    this.errorMessage,
  });
}
