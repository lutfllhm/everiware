const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (email, name, otp) => {
  const textContent = `Halo ${name},\n\nTerima kasih telah bergabung dengan Everiware. Gunakan Kode Verifikasi (OTP) berikut untuk menyelesaikan pendaftaran:\n\nKODE OTP: ${otp}\n\nKode ini berlaku selama 10 menit. Mohon untuk tidak membagikan kode ini kepada siapapun.\n\nTerima kasih,\nTim Everiware`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '🔐 Kode OTP Verifikasi - Everiware',
    text: textContent,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #6B0E11; margin-top: 0;">EVERIWARE</h2>
        <p style="font-size: 11px; color: #64748b; margin: -10px 0 20px 0; text-transform: uppercase; letter-spacing: 1px;">Sistem Absensi Digital</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
        
        <p>Halo <strong>${name}</strong>,</p>
        <p>Terima kasih telah bergabung dengan <strong>Everiware</strong>. Silakan gunakan Kode Verifikasi (OTP) di bawah ini untuk menyelesaikan verifikasi akun Anda:</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #6B0E11;">
          ${otp}
        </div>
        
        <p style="font-size: 12px; color: #dc2626; background-color: #fef2f2; padding: 10px; border-radius: 6px; border-left: 4px solid #ef4444;">
          <strong>⚠️ Penting:</strong> Demi keamanan, mohon tidak membagikan kode verifikasi ini kepada siapa pun. Kode OTP ini berlaku selama <strong>10 menit</strong>.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;">
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas.<br>
          © 2026 Everiware · CV. Rajawali Bina Maju
        </p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (email, name, otp) => {
  const textContent = `Halo ${name},\n\nKami menerima permintaan untuk mereset kata sandi akun Everiware Anda. Gunakan Kode Verifikasi (OTP) berikut untuk membuat password baru:\n\nKODE OTP: ${otp}\n\nKode ini berlaku selama 10 menit. Jika Anda tidak melakukan permintaan ini, abaikan email ini.\n\nTerima kasih,\nTim Everiware`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '🔑 Reset Password - Everiware',
    text: textContent,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #6B0E11; margin-top: 0;">EVERIWARE</h2>
        <p style="font-size: 11px; color: #64748b; margin: -10px 0 20px 0; text-transform: uppercase; letter-spacing: 1px;">Sistem Absensi Digital</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
        
        <p>Halo <strong>${name}</strong>,</p>
        <p>Kami menerima permintaan untuk mereset kata sandi akun Everiware Anda. Silakan gunakan Kode Verifikasi (OTP) di bawah ini untuk membuat kata sandi baru:</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #6B0E11;">
          ${otp}
        </div>
        
        <p style="font-size: 12px; color: #dc2626; background-color: #fef2f2; padding: 10px; border-radius: 6px; border-left: 4px solid #ef4444;">
          <strong>⚠️ Penting:</strong> Kode ini hanya berlaku selama <strong>10 menit</strong>. Jika Anda tidak melakukan permintaan ini, Anda dapat mengabaikan email ini secara aman.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;">
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas.<br>
          © 2026 Everiware · CV. Rajawali Bina Maju
        </p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

const sendLeaveNotification = async (email, name, status, leaveType) => {
  const statusText = status === 'approved' ? 'Disetujui' : 'Ditolak';
  const statusColor = status === 'approved' ? '#16a34a' : '#dc2626';
  
  const textContent = `Halo ${name},\n\nKami menginformasikan bahwa pengajuan izin/cuti Anda untuk jenis ${leaveType} telah selesai diproses dengan status: ${statusText.toUpperCase()}.\n\nSilakan masuk ke aplikasi Everiware untuk detail lengkap.\n\nTerima kasih,\nTim HRD Everiware`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `${status === 'approved' ? '✅' : '❌'} Pengajuan ${leaveType} - ${statusText} - Everiware`,
    text: textContent,
    html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #6B0E11; margin-top: 0;">EVERIWARE</h2>
        <p style="font-size: 11px; color: #64748b; margin: -10px 0 20px 0; text-transform: uppercase; letter-spacing: 1px;">Sistem Absensi Digital</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
        
        <p>Halo <strong>${name}</strong>,</p>
        <p>Kami menginformasikan bahwa pengajuan izin/cuti Anda untuk jenis <strong>${leaveType}</strong> telah selesai diproses oleh HRD/Admin dengan status:</p>
        
        <div style="background-color: ${statusColor}0f; border: 1px solid ${statusColor}40; border-left: 5px solid ${statusColor}; border-radius: 6px; padding: 15px; margin: 20px 0; font-size: 18px; font-weight: bold; color: ${statusColor};">
          ${status === 'approved' ? '✅ DISETUJUI' : '❌ DITOLAK'}
        </div>
        
        <p>Silakan masuk ke aplikasi <strong>Everiware</strong> Anda untuk memeriksa rincian lebih lanjut.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 15px 0;">
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas.<br>
          © 2026 Everiware · CV. Rajawali Bina Maju
        </p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

const sendEmail = async (to, subject, html, text = '') => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  };
  return transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail, sendLeaveNotification, sendPasswordResetEmail, sendEmail };
