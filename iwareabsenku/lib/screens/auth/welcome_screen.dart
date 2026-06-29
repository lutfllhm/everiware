import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class WelcomeScreen extends StatefulWidget {
  final bool isReadOnly;

  const WelcomeScreen({
    super.key,
    this.isReadOnly = false,
  });

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  bool _isAgreed = false;

  Future<void> _completeOnboarding() async {
    if (!widget.isReadOnly) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('has_seen_welcome', true);
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/login');
      }
    } else {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      body: Container(
        height: screenHeight,
        width: screenWidth,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(0xFF6B0E11), // Top deep red
              Color(0xFF380507), // Mid dark red
              Color(0xFF100102), // Bottom almost black-red
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

            // Glowing Ambient Light Spheres (Mesh effect)
            Positioned(
              top: -120,
              left: -120,
              child: Container(
                width: 320,
                height: 320,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEF5350).withOpacity(0.14),
                      blurRadius: 130,
                      spreadRadius: 30,
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              top: screenHeight * 0.4,
              right: -100,
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFE53935).withOpacity(0.08),
                      blurRadius: 120,
                      spreadRadius: 20,
                    ),
                  ],
                ),
              ),
            ),

            SafeArea(
              child: Column(
                children: [
                  // Top Navigation Bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(left: 8.0),
                          child: Text(
                            'PANDUAN & KEBIJAKAN',
                            style: TextStyle(
                              color: Colors.white54,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 2.0,
                              fontSize: 11,
                            ),
                          ),
                        ),
                        if (widget.isReadOnly)
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Colors.white, size: 24),
                            onPressed: () => Navigator.pop(context),
                          )
                        else
                          const SizedBox(width: 48, height: 48),
                      ],
                    ),
                  ),

                  // Main Scrollable Content
                  Expanded(
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 10.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          // ── SECTION 1: ABOUT ───────────────────────────────
                          const SizedBox(height: 12),
                          // Glowing Logo Container
                          Container(
                            width: 100,
                            height: 100,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.35),
                                  blurRadius: 18,
                                  offset: const Offset(0, 6),
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
                          const SizedBox(height: 16),
                          const Text(
                            'EVERIWARE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              fontStyle: FontStyle.italic,
                              letterSpacing: 3.5,
                              fontFamily: 'Usuzi',
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Apa itu Everiware?',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Everiware adalah platform kehadiran digital modern (E-Presensi) yang dirancang untuk mengoptimalkan efisiensi, akurasi, dan transparansi pencatatan kehadiran karyawan di perusahaan secara real-time.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.65),
                              fontSize: 13.5,
                              height: 1.55,
                            ),
                          ),
                          
                          // ── SECTION 2: FEATURES ────────────────────────────
                          const SizedBox(height: 32),
                          _buildSectionHeader(Icons.business_center_outlined, 'Kegunaan & Fitur Utama'),
                          const SizedBox(height: 16),
                          _buildFeatureCard(
                            Icons.check_circle_outline_rounded,
                            'Absensi Masuk & Keluar Kerja',
                            'Lakukan check-in saat mulai bekerja dan check-out saat selesai bekerja secara mandiri dengan cepat menggunakan verifikasi wajah dan GPS.',
                          ),
                          const SizedBox(height: 12),
                          _buildFeatureCard(
                            Icons.insert_drive_file_outlined,
                            'Pengajuan Cuti, Izin, Sakit & Lembur',
                            'Kirimkan form permohonan izin atau lembur secara digital lengkap dengan berkas pendukung langsung kepada tim HRD.',
                          ),
                          const SizedBox(height: 12),
                          _buildFeatureCard(
                            Icons.history_toggle_off_rounded,
                            'Rekap Laporan Kehadiran',
                            'Pantau performa jam kerja, riwayat kehadiran bulanan, serta alokasi cuti Anda secara transparan.',
                          ),

                          // ── SECTION 3: REGULATIONS ─────────────────────────
                          const SizedBox(height: 32),
                          _buildSectionHeader(Icons.gavel_rounded, 'Peraturan & Kebijakan'),
                          const SizedBox(height: 16),
                          _buildRegulationCard(
                            '1',
                            'Larangan Manipulasi GPS (Fake GPS)',
                            'Dilarang keras memanipulasi lokasi GPS menggunakan aplikasi tiruan atau modifikasi perangkat. Sistem mendeteksi otomatis tindakan manipulasi GPS dan akan memberikan sanksi tegas hingga pemblokiran akun.',
                          ),
                          const SizedBox(height: 12),
                          _buildRegulationCard(
                            '2',
                            'Keaslian Foto & Identitas Wajah',
                            'Akun presensi bersifat pribadi. Dilarang mendaftarkan wajah orang lain, berfoto menggunakan foto cetak/layar perangkat lain, atau menitipkan absensi kepada rekan kerja.',
                          ),
                          const SizedBox(height: 12),
                          _buildRegulationCard(
                            '3',
                            'Izin Akses Kamera & Lokasi',
                            'Aplikasi memerlukan izin aktif untuk kamera depan (verifikasi wajah) dan layanan GPS presisi tinggi (validasi geofencing) agar kehadiran dapat diproses secara sah.',
                          ),

                          // ── SECTION 4: CONSENT & ACTION ────────────────────
                          const SizedBox(height: 40),
                          if (!widget.isReadOnly) ...[
                            _buildConsentCheckbox(),
                            const SizedBox(height: 20),
                          ],
                          _buildActionButton(),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(IconData icon, String title) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFFEF5350).withOpacity(0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: const Color(0xFFEF5350), size: 18),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _buildFeatureCard(IconData icon, String title, String desc) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withOpacity(0.11)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF5350).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: const Color(0xFFEF5350), size: 20),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      desc,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.55),
                        fontSize: 12,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRegulationCard(String number, String title, String desc) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white.withOpacity(0.11)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                alignment: Alignment.center,
                width: 24,
                height: 24,
                decoration: const BoxDecoration(
                  color: Color(0xFFEF5350),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  number,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      desc,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.55),
                        fontSize: 12,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildConsentCheckbox() {
    return GestureDetector(
      onTap: () {
        setState(() {
          _isAgreed = !_isAgreed;
        });
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.02),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 24,
              width: 24,
              child: Checkbox(
                value: _isAgreed,
                activeColor: const Color(0xFFEF5350),
                checkColor: Colors.white,
                side: BorderSide(color: Colors.white.withOpacity(0.4), width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                onChanged: (val) {
                  setState(() {
                    _isAgreed = val ?? false;
                  });
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Saya memahami, menyetujui, dan bersedia mematuhi seluruh peraturan perusahaan & ketentuan aplikasi di atas.',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.75),
                  fontSize: 12,
                  height: 1.45,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton() {
    final bool isEnabled = widget.isReadOnly || _isAgreed;

    return Container(
      width: double.infinity,
      height: 52,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: isEnabled
            ? [
                BoxShadow(
                  color: const Color(0xFFEF5350).withOpacity(0.25),
                  blurRadius: 15,
                  offset: const Offset(0, 5),
                ),
              ]
            : [],
      ),
      child: ElevatedButton(
        onPressed: isEnabled ? _completeOnboarding : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF5C0A0B),
          disabledBackgroundColor: Colors.white.withOpacity(0.15),
          disabledForegroundColor: Colors.white.withOpacity(0.25),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 0,
        ),
        child: Text(
          widget.isReadOnly ? 'Tutup Panduan' : 'Setuju & Lanjutkan',
          style: TextStyle(
            fontSize: 15.5,
            fontWeight: FontWeight.w800,
            color: isEnabled ? const Color(0xFF5C0A0B) : Colors.white.withOpacity(0.25),
            letterSpacing: 0.3,
          ),
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
      ..color = Colors.white.withOpacity(0.02)
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
      ..color = Colors.white.withOpacity(0.012)
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
      ..color = Colors.white.withOpacity(0.008)
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
