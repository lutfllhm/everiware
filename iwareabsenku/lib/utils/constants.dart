class AppConstants {
  // Ganti dengan IP PC kamu saat development
  // Contoh: 'http://192.168.120.64:5000/api'
  // Untuk production: 'https://yourdomain.com/api'
  static const String baseUrl = 'http://192.168.120.223:5005/api';
  static const String uploadsUrl = 'http://192.168.120.223:5005/uploads';
  static const String webUrl = 'http://192.168.120.223:5173'; // URL frontend web

  static const String appName = 'Everiware';
  static const String appVersion = '1.0.0';

  // Storage keys
  static const String tokenKey = 'auth_token';
  static const String userKey = 'auth_user';

  // Colors
  static const int primaryColor = 0xFF6366F1;
  static const int secondaryColor = 0xFFA855F7;
}

