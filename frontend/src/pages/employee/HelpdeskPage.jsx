import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Mail, PhoneCall, Building2, ChevronDown, Headset, ChevronRight,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';

const WA_PHONE = '6281249749282';
const WA_TEXT = 'Halo Tim Support Everiware, saya butuh bantuan terkait aplikasi absensi. Terima kasih.';
const EMAIL = 'iwarehrd@gmail.com';
const PHONE_DISPLAY = '0812-4974-9282';

const FAQS = [
  {
    q: 'Bagaimana cara melakukan absensi secara offline?',
    a: 'Saat koneksi internet terputus, Anda tetap dapat menekan tombol Absen Masuk atau Absen Pulang seperti biasa. Data absensi Anda akan disimpan secara lokal di perangkat. Setelah Anda mendapatkan jaringan internet, buka halaman "Akun" lalu ketuk kartu "Absensi Menunggu Sync" untuk menyinkronkan data Anda ke server.',
  },
  {
    q: 'Mengapa deteksi wajah saya gagal saat absensi?',
    a: 'Pastikan wajah Anda berada di area pencahayaan yang cukup (tidak backlight atau gelap). Lepaskan kacamata hitam, masker, atau topi yang menutupi wajah utama Anda. Posisikan kamera sejajar dengan wajah dan usahakan wajah memenuhi area pandang lingkaran.',
  },
  {
    q: 'Bagaimana cara mengajukan Cuti atau Izin?',
    a: 'Buka halaman Beranda, geser ke bawah ke menu pengajuan, pilih "Cuti / Izin". Ketuk tombol tambah di pojok kanan atas, isi detail pengajuan (tanggal, jenis cuti, alasan, dan lampirkan bukti jika sakit), kemudian kirim. Pengajuan Anda akan masuk ke status menunggu persetujuan HRD.',
  },
  {
    q: 'Mengapa lokasi saya dinyatakan di luar radius kantor?',
    a: 'Aplikasi ini menggunakan GPS perangkat untuk memverifikasi lokasi Anda. Pastikan fitur lokasi/GPS aktif dengan mode akurasi tinggi. Jika masih gagal, coba buka Google Maps terlebih dahulu untuk menyegarkan titik koordinat GPS perangkat Anda.',
  },
  {
    q: 'Bagaimana cara memperbarui foto profil saya?',
    a: 'Masuk ke halaman "Akun", ketuk foto profil Anda yang ada di bagian atas. Pilih opsi untuk mengambil foto langsung dari kamera atau memilih gambar yang sudah ada dari galeri foto penyimpanan perangkat Anda.',
  },
];

export default function HelpdeskPage() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="bg-[#F8F7F5] min-h-screen">
      <PageHeader
        title="Pusat Bantuan"
        showBack
        subtitle="Customer Support · Hubungi kami jika memiliki kendala"
      >
        <div className="flex justify-center py-5">
          <div className="w-24 h-24 rounded-full bg-white border-[3.5px] border-white/30 shadow-[0_6px_12px_rgba(0,0,0,0.25)] flex items-center justify-center">
            <Headset size={48} style={{ color: '#8B1F1F' }} />
          </div>
        </div>
      </PageHeader>

      <div className="px-4 pt-5 pb-10 lg:px-8 lg:max-w-3xl lg:mx-auto">

        <h2 className="text-base font-extrabold text-stone-900">Butuh Bantuan Lain?</h2>
        <p className="text-[13px] text-stone-600 mt-1">
          Tim support kami siap membantu Anda menyelesaikan kendala teknis atau administratif.
        </p>

        {/* ── Kontak ── */}
        <div className="mt-4 space-y-3">
          <ContactCard
            wide
            href={`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(WA_TEXT)}`}
            external
            icon={MessageCircle}
            color="#25D366"
            title="Hubungi via WhatsApp"
            subtitle="Respon cepat dari HRD & Support"
          />

          <div className="grid grid-cols-2 gap-3">
            <ContactCard
              href={`mailto:${EMAIL}?subject=Bantuan%20Aplikasi%20Everiware`}
              icon={Mail}
              color="#0EA5E9"
              title="Kirim Email"
              subtitle={EMAIL}
            />
            <ContactCard
              href={`tel:+${WA_PHONE}`}
              icon={PhoneCall}
              color="#7C3AED"
              title="Call Center"
              subtitle={PHONE_DISPLAY}
            />
          </div>
        </div>

        {/* ── FAQ ── */}
        <h2 className="text-base font-extrabold text-stone-900 mt-7">
          Pertanyaan Sering Diajukan (FAQ)
        </h2>

        <div className="mt-3 space-y-2.5">
          {FAQS.map((faq, i) => {
            const open = openFaq === i;
            return (
              <div key={faq.q}
                className="bg-white rounded-2xl border border-[#EEEEEE] shadow-[0_4px_10px_rgba(0,0,0,0.02)] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-stone-50 transition-colors"
                >
                  <span className="flex-1 font-bold text-[13.5px] text-stone-900">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-stone-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4">
                        <div className="h-px bg-[#F5F5F4] mb-3" />
                        <p className="text-[12.5px] text-stone-500 leading-relaxed">{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* ── Info kantor ── */}
        <div className="mt-7 bg-white rounded-2xl border border-[#E7E5E4] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-[18px]">
          <div className="flex items-center gap-2.5">
            <Building2 size={20} style={{ color: '#8B1F1F' }} />
            <h3 className="font-extrabold text-sm text-stone-900">CV. Rajawali Bina Maju</h3>
          </div>

          <div className="h-px bg-[#F5F5F4] my-3" />

          <p className="font-bold text-xs text-stone-600">Alamat Kantor:</p>
          <p className="text-xs text-stone-400 leading-relaxed mt-0.5">
            Iware Official Store, Jl. Babatan Pantai No.14, RT.003/RW.01, Dukuh Sutorejo,
            Kec. Mulyorejo, Surabaya, Jawa Timur 60113, Indonesia
          </p>

          <p className="font-bold text-xs text-stone-600 mt-3">Jam Kerja Layanan Support:</p>
          <p className="text-xs text-stone-400 leading-relaxed mt-0.5 whitespace-pre-line">
            {'Senin - Jumat (08:00 - 17:00 WIB)\nSabtu (08:00 - 15:00 WIB)\nHari Minggu & Tanggal Merah libur.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ href, external, icon: Icon, color, title, subtitle, wide = false }) {
  const rel = external ? 'noopener noreferrer' : undefined;
  const target = external ? '_blank' : undefined;

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={`block bg-white rounded-2xl border border-[#EEEEEE] shadow-[0_4px_10px_rgba(0,0,0,0.02)] px-[18px] hover:border-stone-300 hover:shadow-md active:scale-[0.99] transition-all ${
        wide ? 'py-3.5' : 'py-4'
      }`}
    >
      {wide ? (
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}1A` }}>
            <Icon size={22} style={{ color }} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-extrabold text-sm text-stone-900">{title}</span>
            <span className="block text-[11px] text-stone-400 mt-0.5">{subtitle}</span>
          </span>
          <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
        </div>
      ) : (
        <div className="flex flex-col justify-center min-h-[76px]">
          <span className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}1A` }}>
            <Icon size={18} style={{ color }} />
          </span>
          <span className="block font-extrabold text-[13px] text-stone-900 mt-2">{title}</span>
          <span className="block text-[11px] text-stone-400 truncate mt-0.5">{subtitle}</span>
        </div>
      )}
    </a>
  );
}
