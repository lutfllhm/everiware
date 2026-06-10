import 'dart:convert';
import 'dart:io';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'api_service.dart';


class OfflineAttendanceItem {
  final String id;
  final String mode;        // 'in' | 'out'
  final String photoPath;
  final double latitude;
  final double longitude;
  final DateTime timestamp;
  final Map<String, double>? faceBbox;
  final bool localVerified;
  bool synced;

  OfflineAttendanceItem({
    required this.id,
    required this.mode,
    required this.photoPath,
    required this.latitude,
    required this.longitude,
    required this.timestamp,
    this.faceBbox,
    this.localVerified = true,
    this.synced = false,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'mode': mode,
    'photoPath': photoPath,
    'latitude': latitude,
    'longitude': longitude,
    'timestamp': timestamp.toIso8601String(),
    'faceBbox': faceBbox != null ? Map<String, double>.from(faceBbox!) : null,
    'localVerified': localVerified,
    'synced': synced,
  };

  factory OfflineAttendanceItem.fromJson(Map<String, dynamic> j) =>
      OfflineAttendanceItem(
        id: j['id'],
        mode: j['mode'],
        photoPath: j['photoPath'],
        latitude: (j['latitude'] as num).toDouble(),
        longitude: (j['longitude'] as num).toDouble(),
        timestamp: DateTime.parse(j['timestamp']),
        faceBbox: j['faceBbox'] != null
            ? Map<String, double>.from((j['faceBbox'] as Map).map(
                (k, v) => MapEntry(k.toString(), (v as num).toDouble())))
            : null,
        localVerified: j['localVerified'] ?? true,
        synced: j['synced'] ?? false,
      );
}

class OfflineQueue {
  static const _key = 'offline_attendance_queue';

  static final OfflineQueue _instance = OfflineQueue._internal();
  factory OfflineQueue() => _instance;
  OfflineQueue._internal();

  //  -  -  Simpan item ke antrian  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
  Future<void> enqueue(OfflineAttendanceItem item) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    final List<dynamic> list = raw != null ? jsonDecode(raw) : [];
    list.add(item.toJson());
    await prefs.setString(_key, jsonEncode(list));
  }

  //  -  -  Baca semua antrian  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
  Future<List<OfflineAttendanceItem>> getAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    final List<dynamic> list = jsonDecode(raw);
    return list.map((j) => OfflineAttendanceItem.fromJson(j)).toList();
  }

  //  -  -  Hapus item yang sudah sync  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
  Future<void> removeSynced() async {
    final prefs = await SharedPreferences.getInstance();
    final all = await getAll();
    final pending = all.where((i) => !i.synced).toList();
    await prefs.setString(_key, jsonEncode(pending.map((i) => i.toJson()).toList()));
  }

  //  -  -  Hapus semua  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }

  //  -  -  Jumlah pending  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
  Future<int> pendingCount() async {
    final all = await getAll();
    return all.where((i) => !i.synced).length;
  }

  //  -  -  Cek koneksi  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
  Future<bool> isOnline() async {
    final result = await Connectivity().checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  //  -  -  Sync semua pending ke server  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  -  - 
  /// Mengembalikan jumlah item yang berhasil di-sync
  Future<int> syncAll({void Function(String message)? onProgress}) async {
    if (!await isOnline()) return 0;

    final all = await getAll();
    final pending = all.where((i) => !i.synced).toList();
    if (pending.isEmpty) return 0;

    int synced = 0;
    for (final item in pending) {
      try {
        final file = File(item.photoPath);
        if (!file.existsSync()) {
          // File foto sudah tidak ada  -  tandai synced agar tidak diulang
          item.synced = true;
          continue;
        }

        Map<String, dynamic> result;
        if (item.mode == 'in') {
          result = await ApiService().checkIn(file, item.latitude, item.longitude, faceBbox: item.faceBbox, localVerified: item.localVerified);
        } else {
          result = await ApiService().checkOut(file, item.latitude, item.longitude, faceBbox: item.faceBbox, localVerified: item.localVerified);
        }

        if (result['success'] == true) {
          item.synced = true;
          synced++;
          onProgress?.call(' -  ${item.mode == 'in' ? 'Absen masuk' : 'Absen pulang'} ${_formatTime(item.timestamp)} berhasil disinkronkan');
        } else {
          onProgress?.call(' -  -  ${result['message'] ?? 'Gagal sync'}');
        }
      } catch (e) {
        onProgress?.call(' -  Error: $e');
      }
    }

    // Simpan kembali dengan status synced yang diperbarui
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(all.map((i) => i.toJson()).toList()));

    // Bersihkan yang sudah sync
    await removeSynced();

    return synced;
  }

  String _formatTime(DateTime dt) =>
      '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
}
