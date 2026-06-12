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
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <!-- Header Logo Section -->
          <div style="background-color: #ffffff; padding: 25px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
            <img src="https://everiware.iwareid.com/logo.png" alt="Everiware Logo" style="height: 48px; width: auto; max-width: 100%; display: block; margin: 0 auto;" />
          </div>
          
          <!-- Content Body -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; font-weight: 700; margin-top: 0; color: #0f172a;">Halo ${name},</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">Terima kasih telah bergabung dengan <strong>Everiware</strong>. Silakan gunakan Kode Verifikasi (OTP) di bawah ini untuk menyelesaikan pendaftaran atau verifikasi akun Anda:</p>
            
            <!-- OTP Display Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">KODE OTP VERIFIKASI</span>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #6B0E11; letter-spacing: 6px; display: inline-block; padding-left: 6px;">${otp}</span>
            </div>
            
            <!-- Security Warning Card -->
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 15px; margin: 25px 0;">
              <h4 style="color: #991b1b; margin: 0 0 5px 0; font-size: 13px; font-weight: 700;">⚠️ Keamanan Akun:</h4>
              <ul style="color: #7f1d1d; font-size: 12px; margin: 0; padding-left: 15px; line-height: 1.5;">
                <li>Jangan bagikan kode verifikasi ini kepada siapapun.</li>
                <li>Kode OTP ini hanya berlaku selama <strong>10 menit</strong>.</li>
              </ul>
            </div>
            
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">Jika Anda tidak merasa melakukan permintaan verifikasi ini, abaikan email ini secara aman.</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
            
            <!-- Footer Info -->
            <div style="text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 5px 0;">Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas.</p>
              <p style="margin: 0; font-weight: 600;">© 2026 Everiware · CV. Rajawali Bina Maju. All rights reserved.</p>
            </div>
          </div>
        </div>
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
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <!-- Header Logo Section -->
          <div style="background-color: #ffffff; padding: 25px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
            <img src="https://everiware.iwareid.com/logo.png" alt="Everiware Logo" style="height: 48px; width: auto; max-width: 100%; display: block; margin: 0 auto;" />
          </div>
          
          <!-- Content Body -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; font-weight: 700; margin-top: 0; color: #0f172a;">Halo ${name},</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">Kami menerima permintaan untuk mereset kata sandi akun Everiware Anda. Silakan gunakan Kode Verifikasi (OTP) di bawah ini untuk membuat kata sandi baru:</p>
            
            <!-- OTP Display Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">KODE OTP RESET PASSWORD</span>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #6B0E11; letter-spacing: 6px; display: inline-block; padding-left: 6px;">${otp}</span>
            </div>
            
            <!-- Security Warning Card -->
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 15px; margin: 25px 0;">
              <h4 style="color: #991b1b; margin: 0 0 5px 0; font-size: 13px; font-weight: 700;">⚠️ Keamanan Akun:</h4>
              <ul style="color: #7f1d1d; font-size: 12px; margin: 0; padding-left: 15px; line-height: 1.5;">
                <li>Kode OTP ini hanya berlaku selama <strong>10 menit</strong>.</li>
                <li>Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini secara aman.</li>
              </ul>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
            
            <!-- Footer Info -->
            <div style="text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 5px 0;">Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas.</p>
              <p style="margin: 0; font-weight: 600;">© 2026 Everiware · CV. Rajawali Bina Maju. All rights reserved.</p>
            </div>
          </div>
        </div>
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
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f8fafc; padding: 40px 10px; margin: 0; color: #1e293b;">
        <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <!-- Header Logo Section -->
          <div style="background-color: #ffffff; padding: 25px 20px; text-align: center; border-bottom: 1px solid #f1f5f9;">
            <img src="https://everiware.iwareid.com/logo.png" alt="Everiware Logo" style="height: 48px; width: auto; max-width: 100%; display: block; margin: 0 auto;" />
          </div>
          
          <!-- Content Body -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; font-weight: 700; margin-top: 0; color: #0f172a;">Halo ${name},</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">Kami menginformasikan bahwa pengajuan izin/cuti Anda untuk jenis <strong>${leaveType}</strong> telah selesai diproses oleh HRD/Admin dengan status:</p>
            
            <!-- Status Badge Card -->
            <div style="background-color: ${statusColor}0a; border: 1px solid ${statusColor}20; border-left: 5px solid ${statusColor}; border-radius: 8px; padding: 18px; margin: 25px 0;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 5px;">STATUS AKHIR</span>
              <span style="font-size: 20px; font-weight: 800; color: ${statusColor};">${status === 'approved' ? '✅ DISETUJUI' : '❌ DITOLAK'}</span>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">Silakan masuk ke aplikasi mobile atau dashboard web <strong>Everiware</strong> Anda untuk memeriksa rincian detail atau riwayat lebih lanjut.</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
            
            <!-- Footer Info -->
            <div style="text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 5px 0;">Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas.</p>
              <p style="margin: 0; font-weight: 600;">© 2026 Everiware · CV. Rajawali Bina Maju. All rights reserved.</p>
            </div>
          </div>
        </div>
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
