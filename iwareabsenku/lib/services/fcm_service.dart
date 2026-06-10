// FCM Service  -  Push Notification dengan Action Buttons
//
// SETUP YANG DIPERLUKAN SEBELUM MENGAKTIFKAN FCM:
// 1. Buat project di https://console.firebase.google.com
// 2. Tambahkan app Android dengan package name dari AndroidManifest.xml
// 3. Download google-services.json  -  letakkan di android/app/
// 4. Uncomment bagian FCM di bawah
//
// Local notifications sudah aktif tanpa Firebase.

import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// Callback global untuk handle notif tap (set dari main.dart)
typedef NotifTapCallback = void Function(String? payload);
NotifTapCallback? onNotifTap;

class FcmService {
  static final FcmService _instance = FcmService._internal();
  factory FcmService() => _instance;
  FcmService._internal();

  final _localNotif = FlutterLocalNotificationsPlugin();

  static const _channelId      = 'iwa_main';
  static const _channelName    = 'IWA';
  static const _channelLeave   = 'iwa_leave';
  static const _channelOvertime= 'iwa_overtime';

  Future<void> init({NotifTapCallback? onTap}) async {
    onNotifTap = onTap;

    // Buat channels Android
    final androidPlugin = _localNotif
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      _channelId, _channelName,
      description: 'Notifikasi umum IWA',
      importance: Importance.high,
    ));
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      _channelLeave, 'Izin & Cuti',
      description: 'Notifikasi pengajuan izin dan cuti',
      importance: Importance.high,
    ));
    await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
      _channelOvertime, 'Lembur',
      description: 'Notifikasi pengajuan lembur',
      importance: Importance.high,
    ));

    // Init dengan callback tap
    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      ),
    );

    await _localNotif.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        onNotifTap?.call(details.payload);
      },
    );
  }

  // ── Notifikasi umum ────────────────────────────────────────────────────────
  Future<void> showNotification(String title, String body, {
    String? payload,
    String channel = _channelId,
  }) async {
    await _localNotif.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channel, _channelName,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          styleInformation: BigTextStyleInformation(body),
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: payload,
    );
  }

  // ── Notifikasi izin/cuti dengan action "Lihat Detail" ─────────────────────
  Future<void> showLeaveNotification(String title, String body, {String? leaveId}) async {
    await _localNotif.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelLeave, 'Izin & Cuti',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          color: const Color(0xFF1E293B),
          styleInformation: BigTextStyleInformation(body),
          actions: const [
            AndroidNotificationAction('view_leave', 'Lihat Detail',
                showsUserInterface: true),
          ],
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
          categoryIdentifier: 'leave_category',
        ),
      ),
      payload: 'leave:${leaveId ?? ""}',
    );
  }

  // ── Notifikasi lembur dengan action "Lihat Detail" ────────────────────────
  Future<void> showOvertimeNotification(String title, String body, {String? overtimeId}) async {
    await _localNotif.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelOvertime, 'Lembur',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          color: const Color(0xFF1E293B),
          styleInformation: BigTextStyleInformation(body),
          actions: const [
            AndroidNotificationAction('view_overtime', 'Lihat Detail',
                showsUserInterface: true),
          ],
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: 'overtime:${overtimeId ?? ""}',
    );
  }

  // ── Notifikasi absensi reminder ───────────────────────────────────────────
  Future<void> showAttendanceReminder() async {
    await _localNotif.show(
      99,
      'Jangan lupa absen!',
      'Kamu belum absen masuk hari ini. Tap untuk absen sekarang.',
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId, _channelName,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          actions: const [
            AndroidNotificationAction('open_attendance', 'Absen Sekarang',
                showsUserInterface: true),
          ],
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: 'attendance',
    );
  }

  // ── Alias untuk backward compat ───────────────────────────────────────────
  Future<void> showLocalNotification(String title, String body) =>
      showNotification(title, body);

  Future<String?> getToken() async => null;
  Future<void> deleteToken() async {}
}

// ── Handler payload notifikasi ────────────────────────────────────────────────
// Panggil dari main.dart atau HomeScreen untuk navigasi berdasarkan payload
void handleNotifPayload(String? payload, BuildContext context) {
  if (payload == null) return;
  if (payload == 'attendance') {
    Navigator.pushNamed(context, '/home');
  } else if (payload.startsWith('leave:')) {
    Navigator.pushNamed(context, '/home');
  } else if (payload.startsWith('overtime:')) {
    Navigator.pushNamed(context, '/home');
  }
}

// ── KODE FCM LENGKAP (uncomment setelah google-services.json ditambahkan) ────
//
// import 'package:firebase_messaging/firebase_messaging.dart';
//
// @pragma('vm:entry-point')
// Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {}
//
// Di dalam init():
//   await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
//   FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
//   FirebaseMessaging.onMessage.listen((message) {
//     final n = message.notification;
//     if (n != null) {
//       final type = message.data['type'] ?? '';
//       if (type == 'leave') showLeaveNotification(n.title ?? '', n.body ?? '', leaveId: message.data['id']);
//       else if (type == 'overtime') showOvertimeNotification(n.title ?? '', n.body ?? '', overtimeId: message.data['id']);
//       else showNotification(n.title ?? '', n.body ?? '');
//     }
//   });
//   final token = await FirebaseMessaging.instance.getToken();
//   if (token != null) await ApiService().saveFcmToken(token);
//   FirebaseMessaging.instance.onTokenRefresh.listen((t) => ApiService().saveFcmToken(t));
