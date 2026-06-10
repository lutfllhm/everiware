import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../utils/app_theme.dart';

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
  final PageController _pageController = PageController();
  int _currentPage = 0;
  bool _isAgreed = false;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

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

  void _nextPage() {
    if (_currentPage < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _prevPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
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

            SafeArea(
              child: Column(
                children: [
                  // Top Navigation Bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Back button or brand text
                        _currentPage > 0
                            ? IconButton(
                                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                                onPressed: _prevPage,
                              )
                            : widget.isReadOnly
                                ? IconButton(
                                    icon: const Icon(Icons.close_rounded, color: Colors.white, size: 24),
                                    onPressed: () => Navigator.pop(context),
                                  )
                                : const Padding(
                                    padding: EdgeInsets.only(left: 8.0),
                                    child: Text(
                                      'INFO',
                                      style: TextStyle(
                                        color: Colors.white60,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 1.5,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),

                        // Skip button (only shown if not readOnly and not on the last page)
                        if (!widget.isReadOnly && _currentPage < 2)
                          TextButton(
                            onPressed: () async {
                              // Skipping goes directly to page 2 (regulations page) so they must see regulations
                              _pageController.animateToPage(
                                2,
                                duration: const Duration(milliseconds: 400),
                                curve: Curves.easeInOut,
                              );
                            },
                            child: Text(
                              'Lewati',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.6),
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          )
                        else
                          const SizedBox(width: 48, height: 48), // Spacer to balance
                      ],
                    ),
                  ),

                  // Main Sliders Content
                  Expanded(
                    child: PageView(
                      controller: _pageController,
                      onPageChanged: (index) {
                        setState(() {
                          _currentPage = index;
                        });
                      },
                      children: [
                        _buildSlideAbout(screenHeight),
                        _buildSlideUsage(screenHeight),
                        _buildSlideRegulations(screenHeight),
                      ],
                    ),
                  ),

                  // Bottom Section (Indicator, Checkbox, Buttons)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 16.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Page Indicator Dots
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(3, (index) {
                            final isActive = index == _currentPage;
                            return AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                              width: isActive ? 24 : 8,
                              height: 8,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(4),
                                color: isActive ? const Color(0xFFEF5350) : Colors.white24,
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 24),

                        // Consent Checkbox (only on page 3, if not read-only)
                        if (_currentPage == 2 && !widget.isReadOnly) ...[
                          GestureDetector(
                            onTap: () {
                              setState(() {
                                _isAgreed = !_isAgreed;
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
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
                                      side: BorderSide(color: Colors.white.withOpacity(0.5), width: 1.5),
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
                                        color: Colors.white.withOpacity(0.8),
                                        fontSize: 12,
                                        height: 1.4,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Main Navigation Button
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _currentPage == 2
                                ? (widget.isReadOnly
                                    ? _completeOnboarding
                                    : (_isAgreed ? _completeOnboarding : null))
                                : _nextPage,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFF5C0A0B),
                              disabledBackgroundColor: Colors.white.withOpacity(0.2),
                              disabledForegroundColor: Colors.white.withOpacity(0.3),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 0,
                            ),
                            child: Text(
                              _currentPage == 2
                                  ? (widget.isReadOnly ? 'Tutup Panduan' : 'Setuju & Lanjutkan')
                                  : 'Lanjut',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: _currentPage == 2 && !widget.isReadOnly && !_isAgreed
                                    ? Colors.white.withOpacity(0.3)
                                    : const Color(0xFF5C0A0B),
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
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

  // Slide 1: About the Application
  Widget _buildSlideAbout(double screenHeight) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28.0),
        child: Column(
          children: [
            SizedBox(height: screenHeight * 0.03),
            // Glowing Logo/Icon Card
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.3),
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
            const SizedBox(height: 16),
            const Text(
              'EVERIWARE',
              style: TextStyle(
                color: Colors.white,
                fontSize: 26,
                fontWeight: FontWeight.w900,
                fontStyle: FontStyle.italic,
                letterSpacing: 3.0,
                fontFamily: 'Usuzi',
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Apa itu Everiware?',
              style: TextStyle(
                color: Colors.white.withOpacity(0.9),
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Everiware adalah platform kehadiran digital modern (E-Presensi) yang dirancang untuk mengoptimalkan efisiensi, akurasi, dan transparansi pencatatan kehadiran karyawan di perusahaan secara real-time.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.65),
                fontSize: 14,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 28),
            // Feature Highlights
            _buildFeatureInfoCard(
              Icons.face_retouching_natural_rounded,
              'Verifikasi Wajah (AI Face Recognition)',
              'Mencocokkan wajah Anda secara instan menggunakan kecerdasan buatan lokal untuk validasi kehadiran yang aman dan cepat.',
            ),
            const SizedBox(height: 14),
            _buildFeatureInfoCard(
              Icons.location_on_outlined,
              'Deteksi Geofencing GPS',
              'Memastikan Anda melakukan presensi di radius koordinat lokasi kantor atau area penugasan kerja yang telah ditentukan.',
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // Slide 2: Usage / How to use
  Widget _buildSlideUsage(double screenHeight) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28.0),
        child: Column(
          children: [
            SizedBox(height: screenHeight * 0.02),
            const Icon(
              Icons.business_center_outlined,
              color: Color(0xFFEF5350),
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              'Kegunaan & Fitur Aplikasi',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Aplikasi ini mempermudah urusan administrasi kehadiran Anda langsung dalam satu genggaman:',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.65),
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            // Usage lists
            _buildUsageListItem(
              Icons.check_circle_outline_rounded,
              'Absensi Masuk & Keluar Kerja',
              'Lakukan check-in saat mulai bekerja dan check-out saat selesai bekerja secara mandiri dengan cepat.',
            ),
            const SizedBox(height: 12),
            _buildUsageListItem(
              Icons.insert_drive_file_outlined,
              'Pengajuan Cuti, Izin, Sakit & Lembur',
              'Kirimkan form izin atau klaim jam lembur secara digital lengkap dengan berkas pendukung langsung kepada HRD.',
            ),
            const SizedBox(height: 12),
            _buildUsageListItem(
              Icons.history_toggle_off_rounded,
              'Rekap Laporan Kehadiran',
              'Pantau performa jam kerja, riwayat keterlambatan, dan sisa jatah cuti bulanan Anda dengan transparan.',
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // Slide 3: Regulations
  Widget _buildSlideRegulations(double screenHeight) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28.0),
        child: Column(
          children: [
            SizedBox(height: screenHeight * 0.02),
            const Icon(
              Icons.gavel_rounded,
              color: Color(0xFFEF5350),
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              'Peraturan & Kebijakan',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Demi menjaga kedisiplinan dan integritas data, mohon patuhi peraturan penggunaan aplikasi berikut:',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.65),
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            // Rules box
            _buildRegulationItem(
              '1',
              'Larangan Manipulasi GPS (Fake GPS)',
              'Dilarang keras memanipulasi lokasi GPS menggunakan aplikasi tiruan atau modifikasi perangkat. Sistem mendeteksi otomatis tindakan manipulasi GPS dan akan langsung membekukan akun serta memberikan sanksi keras.',
            ),
            const SizedBox(height: 12),
            _buildRegulationItem(
              '2',
              'Keaslian Foto & Identitas Wajah',
              'Akun presensi bersifat pribadi. Dilarang mendaftarkan wajah orang lain, berfoto menggunakan foto cetak/layar perangkat lain, atau menitipkan absensi kepada rekan kerja.',
            ),
            const SizedBox(height: 12),
            _buildRegulationItem(
              '3',
              'Izin Akses Kamera & Lokasi',
              'Aplikasi memerlukan izin aktif untuk kamera depan (untuk mengenali wajah) dan layanan GPS presisi tinggi (untuk validasi geofencing) agar absensi dapat diproses secara sah.',
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // Helper Widget: Card for Slide 1
  Widget _buildFeatureInfoCard(IconData icon, String title, String desc) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.08)),
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
                    const SizedBox(height: 4),
                    Text(
                      desc,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.55),
                        fontSize: 12,
                        height: 1.4,
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

  // Helper Widget: Card for Slide 2
  Widget _buildUsageListItem(IconData icon, String title, String desc) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFFEF5350), size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.55),
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Helper Widget: Card for Slide 3
  Widget _buildRegulationItem(String number, String title, String desc) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
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
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.55),
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
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
