import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Clock, FileText, Shield, Smartphone, BarChart3, CheckCircle, ArrowRight, Star, Zap } from 'lucide-react';

const features = [
  { icon: MapPin,      title: 'Absen Hanya di Lokasi Kerja',   desc: 'Karyawan hanya bisa absen kalau memang sudah ada di kantor. Tidak bisa titip absen atau absen dari rumah.' },
  { icon: Clock,       title: 'Data Langsung Masuk',            desc: 'Begitu absen, data langsung tercatat. HRD bisa lihat siapa yang sudah masuk dan siapa yang belum, saat itu juga.' },
  { icon: FileText,    title: 'Ajukan Cuti Lewat HP',           desc: 'Tidak perlu isi form kertas. Karyawan ajukan cuti atau izin sakit dari HP, HRD tinggal setujui atau tolak.' },
  { icon: Shield,      title: 'Selfie Saat Absen',              desc: 'Setiap absen wajib foto selfie. Jadi pasti yang absen adalah orangnya langsung, bukan diwakilkan.' },
  { icon: BarChart3,   title: 'Laporan Siap Pakai',             desc: 'Rekap absensi dan cuti tersedia per bulan. Tidak perlu hitung manual lagi saat akhir bulan.' },
  { icon: Smartphone,  title: 'HP atau Komputer, Sama Saja',    desc: 'Bisa dipakai dari HP Android, iPhone, maupun laptop. Tampilannya menyesuaikan otomatis.' },
];

const steps = [
  { step: '1', title: 'Buka Aplikasi',     desc: 'Login pakai akun yang sudah didaftarkan. Bisa lewat HP atau browser di komputer.',          icon: Smartphone },
  { step: '2', title: 'Foto Selfie',        desc: 'Pastikan sudah di area kantor, lalu ambil foto selfie. Sistem cek lokasi otomatis.',          icon: MapPin },
  { step: '3', title: 'Selesai',            desc: 'Absensi langsung tercatat. HRD bisa pantau dari dashboard kapan saja.',                       icon: CheckCircle },
];

const testimonials = [
  { name: 'Budi Santoso',  role: 'HRD Manager',  company: 'PT. Maju Bersama',         text: 'Rekap absensi yang biasanya makan waktu 2 hari sekarang selesai dalam hitungan menit.', rating: 5 },
  { name: 'Sari Dewi',     role: 'Admin HR',      company: 'CV. Karya Mandiri',        text: 'Karyawan kami tersebar di beberapa lokasi. Dengan iWare, semua bisa dipantau dari satu tempat.', rating: 5 },
  { name: 'Ahmad Fauzi',   role: 'Direktur',      company: 'PT. Teknologi Nusantara',  text: 'Tidak ada lagi drama titip absen. Data kehadiran jadi lebih jujur dan bisa dipercaya.', rating: 5 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                <img src="/logo.png" alt="iWare" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-lg text-slate-900">Everiware</span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="hidden sm:block text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">Masuk</Link>
              <Link to="/login" className="bg-slate-900 hover:bg-slate-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
                Mulai Sekarang
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
        <div className="absolute top-20 right-0 w-80 h-80 bg-slate-200 rounded-full filter blur-3xl opacity-40" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-slate-200 rounded-full filter blur-3xl opacity-30" />

        <div className="max-w-6xl mx-auto relative">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-slate-200">
                <Zap size={13} /> Sistem Absensi Digital Internal
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Absensi yang Jujur,<br />
                <span className="text-slate-600">Manajemen yang Mudah</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-2xl mx-auto">
                Capek ngurusin absensi manual yang ribet dan rawan manipulasi? Everiware bikin semuanya lebih simpel — absen lewat HP, pantau dari mana saja.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/login" className="bg-slate-900 hover:bg-slate-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  Coba Sekarang <ArrowRight size={17} />
                </Link>
                <a href="#fitur" className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-8 py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  Lihat Fitur
                </a>
              </div>
            </motion.div>

            {/* Mock dashboard preview */}
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="mt-16">
              <div className="bg-slate-900 rounded-2xl p-1 shadow-2xl shadow-slate-300 max-w-3xl mx-auto">
                <div className="bg-slate-800 rounded-xl p-5">
                  {/* Topbar mock */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md overflow-hidden bg-white">
                        <img src="/logo.png" alt="" className="w-full h-full object-contain" />
                      </div>
                      <span className="text-white text-sm font-semibold">Everiware</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: 'Hadir', value: '47', color: 'text-emerald-400' },
                      { label: 'Terlambat', value: '3', color: 'text-amber-400' },
                      { label: 'Cuti', value: '5', color: 'text-sky-400' },
                      { label: 'Pending', value: '2', color: 'text-purple-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-700 rounded-lg p-3 text-center">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* List */}
                  <div className="bg-slate-700 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-slate-300 text-xs font-semibold">Absensi Hari Ini</span>
                      <span className="text-emerald-400 text-xs">● Live</span>
                    </div>
                    {['Budi Santoso', 'Sari Dewi', 'Ahmad Fauzi'].map((name, i) => (
                      <div key={name} className="flex items-center justify-between py-2 border-b border-slate-600 last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-500 flex items-center justify-center text-white text-xs font-bold">{name[0]}</div>
                          <span className="text-slate-300 text-xs">{name}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${i === 1 ? 'bg-amber-900/50 text-amber-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                          {i === 1 ? 'Terlambat' : 'Hadir'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="py-10 bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {[
              { value: '99.9%', label: 'Uptime' },
              { value: '< 1 detik', label: 'Waktu Absensi' },
              { value: '100%', label: 'Akurasi Lokasi' },
              { value: '24/7', label: 'Bisa Diakses' },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: i * 0.1 }}>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-slate-400 text-sm mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fitur ── */}
      <section id="fitur" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Semua yang Kamu Butuhkan</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Dari absensi harian sampai laporan bulanan, semuanya ada di satu tempat.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md hover:border-slate-300 transition-all">
                <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-slate-700" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cara kerja ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Cara Pakainya Gampang</h2>
            <p className="text-slate-500 text-lg">Tiga langkah, absensi selesai.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((item, i) => (
              <motion.div key={item.step} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}
                className="bg-white border border-slate-200 rounded-2xl p-8 text-center relative">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <item.icon size={22} className="text-white" />
                </div>
                <div className="absolute top-4 right-4 text-5xl font-black text-slate-100 leading-none">{item.step}</div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimoni ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Kata Mereka yang Sudah Pakai</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(t.rating)].map((_, j) => <Star key={j} size={14} className="text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold text-sm">{t.name[0]}</div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                    <div className="text-slate-400 text-xs">{t.role} · {t.company}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Siap Bikin Absensi Lebih Rapi?</h2>
            <p className="text-slate-400 text-lg mb-8">Mulai pakai Everiware sekarang. Gratis untuk tim kamu.</p>
            <Link to="/login" className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-8 py-4 rounded-2xl hover:bg-slate-100 transition-colors shadow-lg">
              Mulai Sekarang <ArrowRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-950 text-slate-500 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-white/10">
              <img src="/logo.png" alt="iWare" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-white text-sm">Everiware</span>
          </div>
          <p className="text-xs">© 2026 Everiware · CV. Rajawali Bina Maju</p>
        </div>
      </footer>
    </div>
  );
}


