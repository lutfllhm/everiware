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
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '🔐 Kode OTP Verifikasi - Everiware',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 15px; margin: 0; min-height: 100%;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.03); overflow: hidden; border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6B0E11 0%, #3a0406 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 800; letter-spacing: 4px; font-style: italic;">EVERIWARE</h1>
              <p style="color: rgba(255, 255, 255, 0.7); margin: 6px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">Sistem Absensi Digital</p>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding: 40px 40px 35px 40px;">
              <p style="color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; margin: 0 0 16px 0;">Halo ${name},</p>
              <p style="color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">Terima kasih telah bergabung dengan <strong>Everiware</strong>. Silakan gunakan Kode Verifikasi (OTP) di bawah ini untuk menyelesaikan pendaftaran atau verifikasi akun Anda:</p>
              
              <!-- OTP Box -->
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 32px auto;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 45px;">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">Kode OTP Verifikasi</div>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #6B0E11; letter-spacing: 8px; margin-left: 8px;">${otp}</span>
                  </td>
                </tr>
              </table>
              
              <!-- Warning / Expiry Card -->
              <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 28px 0; text-align: left;">
                <p style="color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; margin: 0 0 6px 0;">⚠️ Keamanan Akun Anda:</p>
                <ul style="color: #7f1d1d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>Demi keamanan, mohon tidak membagikan kode verifikasi ini kepada siapa pun.</li>
                  <li>Kode OTP ini hanya berlaku selama <strong>10 menit</strong> dari waktu pengiriman email ini.</li>
                </ul>
              </div>
              
              <p style="color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0;">Jika Anda tidak merasa melakukan permintaan verifikasi ini, silakan abaikan email ini secara aman. Hubungi tim support kami jika Anda memerlukan bantuan lebih lanjut.</p>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 35px 0 20px 0;">
              
              <!-- Footer info -->
              <p style="color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; text-align: center; line-height: 1.5; margin: 0;">
                Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas email ini.<br><br>
                © 2026 Everiware · CV. Rajawali Bina Maju. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = async (email, name, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '🔑 Reset Password - Everiware',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 15px; margin: 0; min-height: 100%;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.03); overflow: hidden; border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6B0E11 0%, #3a0406 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 800; letter-spacing: 4px; font-style: italic;">EVERIWARE</h1>
              <p style="color: rgba(255, 255, 255, 0.7); margin: 6px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">Reset Kata Sandi</p>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding: 40px 40px 35px 40px;">
              <p style="color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; margin: 0 0 16px 0;">Halo ${name},</p>
              <p style="color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">Kami menerima permintaan untuk mereset kata sandi akun Everiware Anda. Silakan gunakan Kode Verifikasi (OTP) di bawah ini untuk membuat kata sandi baru:</p>
              
              <!-- OTP Box -->
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 32px auto;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 45px;">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">Kode OTP Reset Password</div>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #6B0E11; letter-spacing: 8px; margin-left: 8px;">${otp}</span>
                  </td>
                </tr>
              </table>
              
              <!-- Warning / Expiry Card -->
              <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 28px 0; text-align: left;">
                <p style="color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; margin: 0 0 6px 0;">⚠️ Keamanan Akun Anda:</p>
                <ul style="color: #7f1d1d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>Demi keamanan, mohon tidak membagikan kode verifikasi ini kepada siapa pun.</li>
                  <li>Kode OTP ini hanya berlaku selama <strong>10 menit</strong> dari waktu pengiriman email ini.</li>
                </ul>
              </div>
              
              <p style="color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0;">Jika Anda tidak melakukan permintaan ini, silakan abaikan email ini. Kata sandi Anda akan tetap aman dan tidak akan diubah.</p>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 35px 0 20px 0;">
              
              <!-- Footer info -->
              <p style="color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; text-align: center; line-height: 1.5; margin: 0;">
                Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas email ini.<br><br>
                © 2026 Everiware · CV. Rajawali Bina Maju. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

const sendLeaveNotification = async (email, name, status, leaveType) => {
  const statusText = status === 'approved' ? '✅ Disetujui' : '❌ Ditolak';
  const statusColor = status === 'approved' ? '#16a34a' : '#dc2626';
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `${statusText} - Pengajuan ${leaveType} - Everiware`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 15px; margin: 0; min-height: 100%;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 25px rgba(0, 0, 0, 0.03); overflow: hidden; border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6B0E11 0%, #3a0406 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 800; letter-spacing: 4px; font-style: italic;">EVERIWARE</h1>
              <p style="color: rgba(255, 255, 255, 0.7); margin: 6px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">Status Permohonan</p>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding: 40px 40px 35px 40px;">
              <p style="color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; margin: 0 0 16px 0;">Halo ${name},</p>
              <p style="color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">Kami menginformasikan bahwa pengajuan izin/cuti Anda untuk jenis <strong>${leaveType}</strong> telah selesai diproses oleh HRD/Admin.</p>
              
              <!-- Status Box -->
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0; width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="background-color: ${statusColor}0a; border: 1px solid ${statusColor}30; border-left: 4px solid ${statusColor}; border-radius: 8px; padding: 20px; text-align: left;">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Status Pengajuan</div>
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 800; color: ${statusColor};">${statusText}</div>
                  </td>
                </tr>
              </table>
              
              <p style="color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">Silakan masuk ke aplikasi <strong>Everiware</strong> Anda untuk memeriksa rincian lebih lanjut.</p>
              
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 35px 0 20px 0;">
              
              <!-- Footer info -->
              <p style="color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; text-align: center; line-height: 1.5; margin: 0;">
                Email ini dikirimkan secara otomatis oleh sistem, mohon untuk tidak membalas email ini.<br><br>
                © 2026 Everiware · CV. Rajawali Bina Maju. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

// Generic send email function
const sendEmail = async (to, subject, html) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  };
  return transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail, sendLeaveNotification, sendPasswordResetEmail, sendEmail };
