const { pool } = require('../config/database');

// Kirim push notification via FCM HTTP v1 API
// Menggunakan googleapis yang sudah ada di package.json
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const fcmServerKey = process.env.FCM_SERVER_KEY;
    if (!fcmServerKey) return; // FCM belum dikonfigurasi, skip

    // Ambil semua token FCM user
    const [tokens] = await pool.query('SELECT token, platform FROM fcm_tokens WHERE user_id = ?', [userId]);
    if (!tokens.length) return;

    const payload = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    };

    for (const { token } of tokens) {
      try {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${fcmServerKey}`,
          },
          body: JSON.stringify({ to: token, ...payload }),
        });
        const result = await res.json();
        // Hapus token yang tidak valid
        if (result.failure && result.results?.[0]?.error === 'NotRegistered') {
          await pool.query('DELETE FROM fcm_tokens WHERE token = ?', [token]);
        }
      } catch {}
    }
  } catch {}
};

// Kirim ke banyak user sekaligus
const sendPushToMany = async (userIds, title, body, data = {}) => {
  await Promise.allSettled(userIds.map(uid => sendPushNotification(uid, title, body, data)));
};

module.exports = { sendPushNotification, sendPushToMany };
