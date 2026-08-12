const { pool } = require('../config/database');
const { google } = require('googleapis');
const fs = require('fs');

// Kirim push notification via FCM HTTP v1 API (service account, bukan legacy server key)
const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];

let _authClientPromise = null;
let _projectId = null;

const loadServiceAccount = () => {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) return JSON.parse(inline);

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    || require('path').join(__dirname, '../../firebase-service-account.json');
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
};

const getAuthClient = () => {
  if (!_authClientPromise) {
    const credentials = loadServiceAccount();
    if (!credentials) return null;
    _projectId = credentials.project_id;
    const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    _authClientPromise = auth.getClient();
  }
  return _authClientPromise;
};

// Kirim push ke satu token FCM lewat HTTP v1 API
const sendToToken = async (token, title, body, data, accessToken) => {
  const message = {
    message: {
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    },
  };

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${_projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const status = errBody?.error?.status;
    if (status === 'UNREGISTERED' || status === 'NOT_FOUND' || status === 'INVALID_ARGUMENT') {
      await pool.query('DELETE FROM fcm_tokens WHERE token = ?', [token]);
    }
  }
};

const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const client = await getAuthClient();
    if (!client) return; // FCM belum dikonfigurasi (service account tidak ditemukan), skip

    const [tokens] = await pool.query('SELECT token FROM fcm_tokens WHERE user_id = ?', [userId]);
    if (!tokens.length) return;

    const { token: accessToken } = await client.getAccessToken();

    await Promise.allSettled(
      tokens.map(({ token }) => sendToToken(token, title, body, data, accessToken))
    );
  } catch {}
};

// Kirim ke banyak user sekaligus
const sendPushToMany = async (userIds, title, body, data = {}) => {
  await Promise.allSettled(userIds.map(uid => sendPushNotification(uid, title, body, data)));
};

module.exports = { sendPushNotification, sendPushToMany };
