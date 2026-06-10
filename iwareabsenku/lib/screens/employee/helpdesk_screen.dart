import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';


class HelpdeskScreen extends StatefulWidget {
  const HelpdeskScreen({super.key});

  @override
  State<HelpdeskScreen> createState() => _HelpdeskScreenState();
}

class _HelpdeskScreenState extends State<HelpdeskScreen> {
  void _openWhatsApp() async {
    const phone = '6281249749282';
    final message = Uri.encodeComponent('Halo Tim Support Everiware, saya butuh bantuan terkait aplikasi absensi. Terima kasih.');
    final url = Uri.parse('https://wa.me/$phone?text=$message');
    try {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tidak dapat membuka WhatsApp'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _openEmail() async {
    final url = Uri.parse('mailto:iwarehrd@gmail.com?subject=Bantuan%20Aplikasi%20Everiware');
    try {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tidak dapat membuka aplikasi Email'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  void _openPhone() async {
    final url = Uri.parse('tel:+6281249749282');
    try {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tidak dapat melakukan panggilan telepon'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  final List<Map<String, String>> _faqs = [
    {
      'q': 'Bagaimana cara melakukan absensi secara offline?',
      'a': 'Saat koneksi internet terputus, Anda tetap dapat menekan tombol Absen Masuk atau Absen Pulang seperti biasa. Data absensi Anda akan disimpan secara lokal di perangkat. Setelah Anda mendapatkan jaringan internet, buka halaman "Akun" lalu ketuk kartu "Absensi Menunggu Sync" untuk menyinkronkan data Anda ke server.'
    },
    {
      'q': 'Mengapa deteksi wajah saya gagal saat absensi?',
      'a': 'Pastikan wajah Anda berada di area pencahayaan yang cukup (tidak backlight atau gelap). Lepaskan kacamata hitam, masker, atau topi yang menutupi wajah utama Anda. Posisikan kamera sejajar dengan wajah dan usahakan wajah memenuhi area pandang lingkaran.'
    },
    {
      'q': 'Bagaimana cara mengajukan Cuti atau Izin?',
      'a': 'Buka halaman Beranda, geser ke bawah ke menu pengajuan, pilih "Cuti / Izin". Ketuk tombol tambah di pojok kanan atas, isi detail pengajuan (tanggal, jenis cuti, alasan, dan lampirkan bukti jika sakit), kemudian kirim. Pengajuan Anda akan masuk ke status menunggu persetujuan HRD.'
    },
    {
      'q': 'Mengapa lokasi saya dinyatakan di luar radius kantor?',
      'a': 'Aplikasi ini menggunakan GPS handphone untuk memverifikasi lokasi Anda. Pastikan fitur lokasi/GPS di HP Anda aktif dengan mode akurasi tinggi. Jika masih gagal, coba buka peta Google Maps terlebih dahulu untuk menyegarkan titik koordinat GPS perangkat Anda.'
    },
    {
      'q': 'Bagaimana cara memperbarui foto profil saya?',
      'a': 'Masuk ke halaman "Akun", ketuk foto profil Anda yang ada di bagian atas. Pilih opsi untuk mengambil foto langsung dari kamera atau memilih gambar yang sudah ada dari galeri foto penyimpanan HP Anda.'
    }
  ];

  Widget _buildHeroHeader(BuildContext context) {
    return ProfileHeader(
      title: 'Pusat Bantuan',
      showBackButton: true,
      customSubtitle: 'Customer Support\nHubungi kami jika memiliki kendala',
      customCenterWidget: Container(
        width: 96,
        height: 96,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          border: Border.all(color: Colors.white.withOpacity(0.3), width: 3.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.25),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: const Center(
          child: Icon(
            Icons.support_agent_rounded,
            color: Color(0xFF8B1F1F),
            size: 48,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _buildHeroHeader(context),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const Text(
                    'Butuh Bantuan Lain?',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Tim support kami siap membantu Anda menyelesaikan kendala teknis atau administratif.',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  _buildContactSection(),
                  const SizedBox(height: 28),
                  const Text(
                    'Pertanyaan Sering Diajukan (FAQ)',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 12),
                  ..._faqs.map((faq) => _FaqItem(question: faq['q']!, answer: faq['a']!)),
                  const SizedBox(height: 28),
                  _buildOfficeInfoCard(),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContactSection() {
    return Column(
      children: [
        _buildContactCard(
          title: 'Hubungi via WhatsApp',
          subtitle: 'Respon cepat dari HRD & Support',
          icon: Icons.chat_bubble_rounded,
          color: const Color(0xFF25D366),
          onTap: _openWhatsApp,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildContactCard(
                title: 'Kirim Email',
                subtitle: 'iwarehrd@gmail.com',
                icon: Icons.email_rounded,
                color: const Color(0xFF0EA5E9),
                onTap: _openEmail,
                height: 100,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildContactCard(
                title: 'Call Center',
                subtitle: '0812-4974-9282',
                icon: Icons.phone_in_talk_rounded,
                color: const Color(0xFF7C3AED),
                onTap: _openPhone,
                height: 100,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildContactCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    double height = 74,
  }) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEEEEEE), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            child: height > 80
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, color: color, size: 20),
                      ),
                      const Spacer(),
                      Text(
                        title,
                        style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w800, fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  )
                : Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, color: color, size: 22),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w800, fontSize: 14),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              subtitle,
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: AppColors.textMuted, size: 14),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildOfficeInfoCard() {
    return const AppCard(
      padding: EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.business_rounded, color: Color(0xFF8B1F1F), size: 20),
              SizedBox(width: 10),
              Text(
                'CV. Rajawali Bina Maju',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.textPrimary),
              ),
            ],
          ),
          SizedBox(height: 12),
          Divider(height: 1, color: AppColors.divider),
          SizedBox(height: 12),
          Text(
            'Alamat Kantor:',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textSecondary),
          ),
          SizedBox(height: 2),
          Text(
            'Jl. Rajawali No. 88, Jakarta Pusat, Indonesia',
            style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
          ),
          SizedBox(height: 12),
          Text(
            'Jam Kerja Layanan Support:',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textSecondary),
          ),
          SizedBox(height: 2),
          Text(
            'Senin - Sabtu (08:00 - 17:00 WIB)\nHari Minggu & Libur Nasional tutup.',
            style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _FaqItem extends StatefulWidget {
  final String question;
  final String answer;

  const _FaqItem({required this.question, required this.answer});

  @override
  State<_FaqItem> createState() => _FaqItemState();
}

class _FaqItemState extends State<_FaqItem> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEEE)),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() => _expanded = !_expanded);
            },
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.question,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: AppColors.textPrimary,
                        height: 1.4,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: AppColors.textMuted,
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOut,
            child: _expanded
                ? Container(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    alignment: Alignment.topLeft,
                    child: Column(
                      children: [
                        const Divider(height: 1, color: AppColors.divider),
                        const SizedBox(height: 12),
                        Text(
                          widget.answer,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
