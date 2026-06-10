import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;
import 'package:image/image.dart' as img;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:uuid/uuid.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import '../../services/api_service.dart';
import '../../services/offline_queue.dart';
import '../../services/face_recognizer.dart';
import '../../utils/app_theme.dart';
import '../../utils/constants.dart';
import '../../widgets/common_widgets.dart';
import '../../models/user_model.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import 'package:intl/intl.dart';
import '../../services/realtime_service.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  AttendanceModel? _todayAtt;
  Map<String, dynamic>? _workInfo;
  List<dynamic> _activePermits = [];
  Map<String, dynamic> _permissionSettings = {};
  bool _loading = true;
  StreamSubscription? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _loadToday();

    _realtimeSub = RealtimeService().events.listen((event) {
      if (event['event'] == 'attendance_update') {
        _loadToday();
      }
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  Future<void> _loadToday() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getTodayAttendance();
      if (mounted) {
        setState(() {
          _todayAtt = data['attendance'] != null
              ? AttendanceModel.fromJson(data['attendance'])
              : null;
          _workInfo = data['work_info'];
          _activePermits = data['active_permits'] is List ? data['active_permits'] : [];
          _permissionSettings = data['permission_settings'] is Map
              ? Map<String, dynamic>.from(data['permission_settings'])
              : {};
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCamera(String mode) async {
    // Minta izin kamera
    final camStatus = await Permission.camera.request();
    if (!camStatus.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Izin kamera diperlukan untuk absensi'),
          backgroundColor: AppColors.primary,
        ));
      }
      return;
    }

    List<CameraDescription> cameras = [];
    try {
      cameras = await availableCameras();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Kamera tidak tersedia'),
          backgroundColor: AppColors.primary,
        ));
      }
      return;
    }

    if (!mounted) return;
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => CameraScreen(cameras: cameras, mode: mode)),
    );
    if (result == true) _loadToday();
  }

  /// Get display label for permit type code
  String _permitLabel(String? code) {
    switch (code) {
      case 'late_permission':
        return 'Izin Terlambat';
      case 'early_leave':
        return 'Izin Pulang Cepat';
      case 'leave_office':
        return 'Izin Keluar Kantor';
      default:
        return 'Izin Aktif';
    }
  }

  /// Get info text for a permit
  String _permitInfo(Map<String, dynamic> permit) {
    final code = permit['leave_type_code'] as String?;
    if (code == 'late_permission') {
      return 'Anda dapat check-in maksimal ${_permissionSettings['late_permission_max_time'] ?? '11:00'} WIB';
    } else if (code == 'early_leave') {
      return 'Anda dapat check-out minimal ${_permissionSettings['early_leave_min_time'] ?? '13:00'} WIB';
    } else if (code == 'leave_office') {
      return 'Izin keluar kantor aktif hari ini';
    }
    return 'Izin aktif hari ini';
  }

  /// Compute display status for the attendance
  String get _displayStatus {
    if (_todayAtt == null) return 'unknown';
    final rawStatus = _todayAtt!.status;
    // If present and has late_permission, show modified status
    if (rawStatus == 'present' &&
        _activePermits.any((p) => p['leave_type_code'] == 'late_permission')) {
      return 'present_late';
    }
    return rawStatus;
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: RefreshIndicator(
        onRefresh: _loadToday,
        color: const Color(0xFF8B1F1F),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ── Redesigned Header ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: ProfileHeader(
                title: 'Absensi Harian',
                name: user?.name,
                position: user?.position ?? user?.roleLabel,
                department: user?.department ?? user?.deptPosition,
                avatarFilename: user?.avatar,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // ── Tombol Absen ─────────────────────────────────────────
                  Row(children: [
                    Expanded(child: _AttendanceButton(
                      label: 'Absen Masuk',
                      sub: _todayAtt?.checkIn != null ? 'Sudah absen ✓' : 'Tap untuk absen',
                      icon: Icons.login_rounded,
                      enabled: !_loading && _todayAtt?.checkIn == null,
                      color: const Color(0xFF8B1F1F),
                      onTap: () => _openCamera('in'),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: _AttendanceButton(
                      label: 'Absen Pulang',
                      sub: _todayAtt?.checkOut != null
                          ? 'Sudah absen ✓'
                          : _todayAtt?.checkIn == null
                              ? 'Belum masuk'
                              : 'Tap untuk absen',
                      icon: Icons.logout_rounded,
                      enabled: !_loading && _todayAtt?.checkIn != null && _todayAtt?.checkOut == null,
                      color: const Color(0xFF8B1F1F),
                      onTap: () => _openCamera('out'),
                    )),
                  ]),
                  // ── Izin Aktif (Permits) Banner ──────────────────────────
                  if (_activePermits.isNotEmpty) ...[
                    for (var permit in _activePermits) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.successBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.successBorder, width: 1),
                          boxShadow: AppColors.cardShadow(),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: AppColors.success.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.info_rounded, color: AppColors.success, size: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _permitLabel(permit['leave_type_code']),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      color: AppColors.success,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _permitInfo(permit),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                      height: 1.4,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],

                  const SizedBox(height: 16),

                  // ── Status Card ───────────────────────────────────────────
                  AppCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Container(width: 4, height: 18,
                          decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF8B1F1F), Color(0xFFDC2626)],
                              begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(2))),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text('Status Hari Ini',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                        ),
                        if (!_loading && _todayAtt != null)
                          StatusBadge(status: _displayStatus, compact: true),
                      ]),
                      const SizedBox(height: 14),
                      if (_loading)
                        const Center(child: Padding(
                          padding: EdgeInsets.all(20),
                          child: CircularProgressIndicator(color: Color(0xFF8B1F1F)),
                        ))
                      else if (_todayAtt != null) ...[
                        Row(children: [
                          Expanded(child: _InfoTile(icon: Icons.login_rounded, label: 'Jam Masuk',
                            value: _todayAtt!.checkIn != null ? DateFormat('HH:mm').format(_todayAtt!.checkIn!) : '--:--',
                            color: const Color(0xFF8B1F1F))),
                          const SizedBox(width: 12),
                          Expanded(child: _InfoTile(icon: Icons.logout_rounded, label: 'Jam Pulang',
                            value: _todayAtt!.checkOut != null ? DateFormat('HH:mm').format(_todayAtt!.checkOut!) : '--:--',
                            color: const Color(0xFF8B1F1F))),
                        ]),
                        if (_todayAtt!.locationName != null) ...[
                          const SizedBox(height: 12),
                          Row(children: [
                            const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 6),
                            Flexible(child: Text(_todayAtt!.locationName!,
                                style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                                overflow: TextOverflow.ellipsis)),
                          ]),
                        ],
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.primaryBg.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.primaryBorder, width: 1),
                          ),
                          child: Row(children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                gradient: AppColors.primaryGradient,
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: AppColors.glowShadow(AppColors.primary, alpha: 0.2),
                              ),
                              child: const Icon(Icons.fingerprint, color: Colors.white, size: 24),
                            ),
                            const SizedBox(width: 14),
                            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('Belum absen hari ini',
                                  style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary, fontSize: 14.5)),
                              SizedBox(height: 3),
                              Text('Tap tombol absen di atas untuk mulai',
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12.5)),
                            ])),
                          ]),
                        ),
                      ],
                    ]),
                  ),
                  const SizedBox(height: 16),

                  // ── Info Syarat ───────────────────────────────────────────
                  AppCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.verified_user_outlined, size: 16, color: AppColors.primary),
                        ),
                        const SizedBox(width: 10),
                        const Text('Persyaratan Absensi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                      ]),
                      const SizedBox(height: 14),
                      ...[
                        user?.locationName != null && user!.locationName!.isNotEmpty
                            ? 'Harus berada di area lokasi penempatan: ${user.locationName}'
                            : 'Harus berada di area lokasi kerja yang ditentukan',
                        'Wajib selfie foto untuk verifikasi wajah',
                        'Pastikan koneksi internet & GPS aktif di perangkat kamu',
                      ].map((s) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Container(width: 6, height: 6, margin: const EdgeInsets.only(top: 6, right: 10),
                            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
                          Expanded(child: Text(s, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4))),
                        ]),
                      )),
                    ]),
                  ),

                  if (_workInfo != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: _workInfo!['is_saturday'] == true ? AppColors.accentBg : AppColors.primaryBg.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: _workInfo!['is_saturday'] == true ? AppColors.amber100 : AppColors.primaryBorder, width: 1),
                      ),
                      child: Row(children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: (_workInfo!['is_saturday'] == true ? AppColors.amber : AppColors.primary).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(_workInfo!['is_saturday'] == true ? Icons.wb_sunny_outlined : Icons.schedule_rounded,
                              size: 18, color: _workInfo!['is_saturday'] == true ? AppColors.amber : AppColors.primary),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(_workInfo!['is_saturday'] == true ? 'Hari Sabtu - Setengah Hari' : 'Jam Kerja Hari Ini',
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5,
                                  color: _workInfo!['is_saturday'] == true ? AppColors.warning : AppColors.primary)),
                          const SizedBox(height: 2),
                          Text('Masuk: ${_workInfo!['start_time']} - Pulang: ${_workInfo!['end_time']} WIB',
                              style: TextStyle(fontSize: 12,
                                  color: _workInfo!['is_saturday'] == true ? AppColors.warning : AppColors.textSecondary)),
                        ])),
                      ]),
                    ),
                  ],
                  const SizedBox(height: 80),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}



//  -  -  Info Tile  -  - 
//  -  -  Info Tile  -  - 
class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label, value;
  final Color color;
  const _InfoTile(
      {required this.icon,
      required this.label,
      required this.value,
      required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    decoration: BoxDecoration(
      color: color.withOpacity(0.06),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: color.withOpacity(0.12), width: 1),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
        ],
      ),
      const SizedBox(height: 8),
      Text(value,
          style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.2)),
    ]),
  );
}

//  -  -  Attendance Button  -  - 
class _AttendanceButton extends StatelessWidget {
  final String label, sub;
  final IconData icon;
  final bool enabled;
  final Color color;
  final VoidCallback onTap;
  const _AttendanceButton(
      {required this.label, required this.sub, required this.icon,
       required this.enabled, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: enabled ? () {
      HapticFeedback.mediumImpact();
      onTap();
    } : null,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 20),
      decoration: BoxDecoration(
        gradient: enabled
            ? LinearGradient(
                colors: [color, color.withOpacity(0.8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        color: enabled ? null : AppColors.grey100,
        borderRadius: BorderRadius.circular(20),
        boxShadow: enabled
            ? [
                BoxShadow(
                  color: color.withOpacity(0.25),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ]
            : [],
      ),
      child: Column(children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(
            color: enabled ? Colors.white.withOpacity(0.2) : AppColors.grey200,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: enabled ? Colors.white : AppColors.grey400, size: 26),
        ),
        const SizedBox(height: 12),
        Text(label,
            style: TextStyle(
              color: enabled ? Colors.white : AppColors.grey400,
              fontWeight: FontWeight.w800,
              fontSize: 14.5,
            )),
        const SizedBox(height: 3),
        Text(sub,
            style: TextStyle(
              color: enabled ? Colors.white.withOpacity(0.7) : AppColors.grey400,
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
            )),
      ]),
    ),
  );
}

class CameraScreen extends StatefulWidget {
  final List<CameraDescription> cameras;
  final String mode;
  const CameraScreen({super.key, required this.cameras, required this.mode});
  @override
  State<CameraScreen> createState() => _CameraScreenState();
}
class _CameraScreenState extends State<CameraScreen> {
  CameraController? _controller;
  XFile? _photo;
  Position? _position;
  bool _gettingLocation = false;
  bool _submitting = false;
  bool _capturing = false;
  bool _verifying = false;
  bool _verified = false;
  String? _locationError;
  String? _cameraError;
  String? _verifyError;

  List<double>? _referenceEmbedding;
  Map<String, double>? _faceBbox;
  late final FaceDetector _faceDetector;

  String? _livenessStatus;
  String _livenessInstruction = '';

  int _verifyAttempts = 0;
  bool _useServerFallback = false;

  @override
  void initState() {
    super.initState();
    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        enableClassification: false,
        enableLandmarks: false,
        enableContours: false,
        enableTracking: false,
        minFaceSize: 0.05,
        performanceMode: FaceDetectorMode.accurate,
      ),
    );
    _initCamera();
    _getLocation();
    _loadReferenceEmbedding();
  }

  @override
  void dispose() {
    _controller?.dispose();
    _faceDetector.close();
    super.dispose();
  }

  Future<void> _loadReferenceEmbedding() async {
    final user = Provider.of<AuthProvider>(context, listen: false).user;
    if (user == null) return;
    
    final int retryCount = 3;
    bool success = false;
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedKey = 'face_embedding_${user.id}';
      final cachedAvatarKey = 'face_embedding_avatar_${user.id}';
      final cachedStr = prefs.getString(cachedKey);
      final cachedAvatar = prefs.getString(cachedAvatarKey);
      
      // Use facePhoto only for face verification; profile photo (avatar) should not affect it
      final currentReference = (user.facePhoto != null && user.facePhoto!.trim().isNotEmpty)
          ? user.facePhoto!.trim()
          : '';

      if (cachedStr != null && cachedAvatar == currentReference && currentReference.isNotEmpty) {
        try {
          final List<dynamic> jsonList = jsonDecode(cachedStr);
          _referenceEmbedding = jsonList.map((e) => (e as num).toDouble()).toList();
          print('[AttendanceScreen] Loaded reference embedding from cache successfully.');
          return;
        } catch (e) {
          print('[AttendanceScreen] Failed to decode cached embedding: $e');
        }
      }

      if (currentReference.isNotEmpty) {
        for (int attempt = 1; attempt <= retryCount; attempt++) {
          try {
            print('[AttendanceScreen] Attempting to load reference embedding (Attempt $attempt/$retryCount)...');
            final referenceUrl = '${AppConstants.uploadsUrl}/avatar/$currentReference';
            final tempDir = await getTemporaryDirectory();
            final tempPath = '${tempDir.path}/temp_ref_${user.id}.jpg';
            
            await ApiService().dio.download(referenceUrl, tempPath);
            final avatarFile = File(tempPath);
            
            if (await avatarFile.exists() && await avatarFile.length() > 0) {
              final refDetector = FaceDetector(
                options: FaceDetectorOptions(
                  minFaceSize: 0.05,
                  performanceMode: FaceDetectorMode.accurate,
                ),
              );
              final faces = await refDetector.processImage(InputImage.fromFilePath(tempPath));
              await refDetector.close();
              
              Rect? bbox;
              if (faces.isNotEmpty) {
                bbox = faces.first.boundingBox;
                print('[AttendanceScreen] Face detected on reference image.');
              } else {
                print('[AttendanceScreen] ML Kit failed to detect face on reference. Calculating generous center crop.');
                try {
                  final refBytes = await avatarFile.readAsBytes();
                  final decoded = img.decodeImage(refBytes);
                  if (decoded != null) {
                    final w = decoded.width;
                    final h = decoded.height;
                    final size = (min(w, h) * 0.85).toInt();
                    final x = (w - size) ~/ 2;
                    final y = (h - size) ~/ 2;
                    bbox = Rect.fromLTWH(x.toDouble(), y.toDouble(), size.toDouble(), size.toDouble());
                  }
                } catch (cropErr) {
                  print('[AttendanceScreen] Failed to decode image for center crop: $cropErr');
                }
              }
              
              final embedding = await FaceRecognizer().predict(avatarFile, bbox);
              if (embedding != null) {
                _referenceEmbedding = embedding;
                await prefs.setString(cachedKey, jsonEncode(embedding));
                await prefs.setString(cachedAvatarKey, currentReference);
                print('[AttendanceScreen] Successfully generated and cached new reference embedding.');
                success = true;
                
                try { await avatarFile.delete(); } catch (_) {}
                break;
              }
              try { await avatarFile.delete(); } catch (_) {}
            }
          } catch (e) {
            print('[AttendanceScreen] Attempt $attempt failed with error: $e');
            if (attempt == retryCount) {
              rethrow;
            }
            await Future.delayed(Duration(milliseconds: 500 * attempt));
          }
        }
      }
      
      // Fallback: If regeneration failed but we still have a cached embedding, keep using the cached embedding
      if (!success && cachedStr != null) {
        print('[AttendanceScreen] Regeneration failed, falling back to existing cache.');
        try {
          final List<dynamic> jsonList = jsonDecode(cachedStr);
          _referenceEmbedding = jsonList.map((e) => (e as num).toDouble()).toList();
        } catch (_) {}
      }
    } catch (e) {
      print('[AttendanceScreen] Error in _loadReferenceEmbedding: $e');
    }
  }

  Future<void> _initCamera() async {
    try {
      final front = widget.cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => widget.cameras.first,
      );
      _controller = CameraController(front, ResolutionPreset.high, enableAudio: false);
      await _controller!.initialize();
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) setState(() => _cameraError = 'Gagal membuka kamera: $e');
    }
  }

  Future<void> _getLocation() async {
    if (mounted) setState(() { _gettingLocation = true; _locationError = null; });
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) setState(() {
          _locationError = 'GPS tidak aktif. Aktifkan GPS di pengaturan.';
          _gettingLocation = false;
        });
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
        if (mounted) setState(() {
          _locationError = 'Izin lokasi ditolak. Aktifkan di pengaturan app.';
          _gettingLocation = false;
        });
        return;
      }
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      _position = pos;
      if (mounted) setState(() => _gettingLocation = false);
    } catch (e) {
      if (mounted) setState(() {
        _locationError = 'Gagal mendapatkan lokasi. Coba lagi.';
        _gettingLocation = false;
      });
    }
  }

  Future<void> _capturePhoto() async {
    if (_controller == null || !_controller!.value.isInitialized || _capturing) return;
    
    setState(() {
      _capturing = true;
      _photo = null;
      _verified = false;
      _verifyError = null;
      _livenessStatus = null;
    });

    try {
      HapticFeedback.mediumImpact();
      final photo = await _controller!.takePicture();
      
      setState(() {
        _verifying = true;
      });

      final faces = await _faceDetector.processImage(InputImage.fromFilePath(photo.path));
      if (faces.isEmpty) {
        if (mounted) {
          setState(() {
            _capturing = false;
            _verifying = false;
            _verifyError = 'Wajah tidak terdeteksi. Silakan coba lagi di tempat yang cukup terang.';
          });
        }
        try { File(photo.path).delete(); } catch (_) {}
        return;
      }

      final face = faces.first;
      final bbox = face.boundingBox;
      _faceBbox = {
        'x': bbox.left.toDouble(),
        'y': bbox.top.toDouble(),
        'width': bbox.width.toDouble(),
        'height': bbox.height.toDouble(),
      };

      if (_useServerFallback) {
        // Skip local matching completely, let backend do it
        HapticFeedback.mediumImpact();
        setState(() {
          _photo = photo;
          _capturing = false;
          _verifying = false;
          _verified = true;
        });
        return;
      }

      if (_referenceEmbedding == null) {
        await _loadReferenceEmbedding();
      }
      if (!mounted) return;

      if (_referenceEmbedding == null) {
        setState(() {
          _capturing = false;
          _verifying = false;
          _verifyError = 'Ops! Wajah referensimu belum terdaftar. Daftarkan dulu di menu Profil.';
        });
        try { File(photo.path).delete(); } catch (_) {}
        return;
      }

      final selfieEmbedding = await FaceRecognizer().predict(
        File(photo.path),
        Rect.fromLTWH(bbox.left, bbox.top, bbox.width, bbox.height),
      );
      if (!mounted) return;

      if (selfieEmbedding == null) {
        setState(() {
          _capturing = false;
          _verifying = false;
          _verifyError = 'Gagal memproses verifikasi wajah. Harap posisikan kepala tegak.';
        });
        try { File(photo.path).delete(); } catch (_) {}
        return;
      }

      final match = FaceRecognizer().isMatch(selfieEmbedding, _referenceEmbedding!);
      if (!match) {
        HapticFeedback.heavyImpact();
        setState(() {
          _capturing = false;
          _verifying = false;
          _verifyAttempts++;
          _verifyError = 'Wajah tidak cocok dengan akun kamu. Pastikan ini adalah Anda.\n\nTips Absensi:\n• Pastikan wajah menghadap ke depan dengan tegak\n• Cari area dengan pencahayaan yang cukup terang\n• Hindari membelakangi cahaya (backlight)\n• Lepaskan masker, kacamata hitam, atau topi';
        });
        try { File(photo.path).delete(); } catch (_) {}
        return;
      }

      // Verifikasi sukses!
      HapticFeedback.mediumImpact();
      setState(() {
        _photo = photo;
        _capturing = false;
        _verifying = false;
        _verified = true;
      });

    } catch (e) {
      if (mounted) {
        setState(() {
          _capturing = false;
          _verifying = false;
          _verifyError = 'Terjadi kesalahan sistem saat memproses verifikasi: $e';
        });
      }
    }
  }

  void _retakePhoto() {
    setState(() {
      _photo = null;
      _verified = false;
      _verifyError = null;
      _faceBbox = null;
      _livenessStatus = null;
    });
  }

  Future<void> _submit() async {
    if (_photo == null || !_verified) return;
    if (_position == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Lokasi belum didapat. Tunggu atau aktifkan GPS'),
        backgroundColor: AppColors.amber,
      ));
      return;
    }
    setState(() => _submitting = true);

    final connectivity = await Connectivity().checkConnectivity();
    final isOnline = !connectivity.contains(ConnectivityResult.none);

    try {
      final file = File(_photo!.path);
      final bool localVerified = !_useServerFallback;

      if (isOnline) {
        final data = widget.mode == 'in'
            ? await ApiService().checkIn(file, _position!.latitude, _position!.longitude, faceBbox: _faceBbox, localVerified: localVerified)
            : await ApiService().checkOut(file, _position!.latitude, _position!.longitude, faceBbox: _faceBbox, localVerified: localVerified);
        if (!mounted) return;
        if (data['success'] == true) {
          final user = Provider.of<AuthProvider>(context, listen: false).user;
          await Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => AttendanceSuccessScreen(
                mode: widget.mode,
                userName: user?.name ?? 'Karyawan',
                userPosition: user?.position ?? user?.roleLabel ?? 'Staf',
                userNip: user?.employeeId ?? '-',
                userAvatar: user?.avatar,
                locationName: (data['attendance'] as Map<String, dynamic>?)?['location_name']?.toString()
                    ?? data['location']?.toString()
                    ?? user?.locationName
                    ?? '-',
                checkTime: DateTime.now(),
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Row(children: [
              const Icon(Icons.error_outline, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Expanded(child: Text(data['message'] ?? 'Absensi gagal',
                  style: const TextStyle(fontSize: 13))),
            ]),
            backgroundColor: AppColors.primary,
            duration: const Duration(seconds: 5),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          ));
          if (mounted) _retakePhoto();
        }
      } else {
        final item = OfflineAttendanceItem(
          id: const Uuid().v4(),
          mode: widget.mode,
          photoPath: _photo!.path,
          latitude: _position!.latitude,
          longitude: _position!.longitude,
          timestamp: DateTime.now(),
          faceBbox: _faceBbox,
          localVerified: localVerified,
        );
        await OfflineQueue().enqueue(item);
        if (!mounted) return;
        final user = Provider.of<AuthProvider>(context, listen: false).user;
        await Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => AttendanceSuccessScreen(
              mode: widget.mode,
              userName: user?.name ?? 'Karyawan',
              userPosition: user?.position ?? user?.roleLabel ?? 'Staf',
              userNip: user?.employeeId ?? '-',
              userAvatar: user?.avatar,
              locationName: user?.locationName ?? '-',
              checkTime: DateTime.now(),
              isOffline: true,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: $e'),
          backgroundColor: AppColors.primary,
        ));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          _buildCameraLayer(),
          SafeArea(child: _buildTopBar()),
          Align(
            alignment: Alignment.bottomCenter,
            child: _buildBottomPanel(),
          ),
        ],
      ),
    );
  }

  Widget _buildCameraLayer() {
    if (_cameraError != null) {
      return Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.camera_alt_outlined, color: Colors.white38, size: 56),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(_cameraError!,
                style: const TextStyle(color: Colors.white54, fontSize: 14),
                textAlign: TextAlign.center),
          ),
        ]),
      );
    }
    if (_photo != null) {
      return SizedBox.expand(child: Image.file(File(_photo!.path), fit: BoxFit.cover));
    }
    if (_controller?.value.isInitialized != true) {
      return const Center(child: CircularProgressIndicator(color: Colors.white54, strokeWidth: 2));
    }
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: _controller!.value.previewSize!.height,
          height: _controller!.value.previewSize!.width,
          child: CameraPreview(_controller!),
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _GlassIconButton(icon: Icons.close_rounded, onTap: () => Navigator.pop(context)),
          const Spacer(),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.mode == 'in' ? 'ABSEN MASUK' : 'ABSEN PULANG',
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 2.5),
              ),
              const SizedBox(height: 2),
              Text(
                DateFormat('HH:mm · EEE, d MMM', 'id_ID').format(DateTime.now()),
                style: TextStyle(color: Colors.white.withOpacity(0.55), fontSize: 11, letterSpacing: 0.3),
              ),
            ],
          ),
          const Spacer(),
          _buildGPSBadge(),
        ],
      ),
    );
  }

  Widget _buildGPSBadge() {
    if (_gettingLocation) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.15)),
        ),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(width: 10, height: 10, child: CircularProgressIndicator(color: Colors.white70, strokeWidth: 1.5)),
          SizedBox(width: 5),
          Text('GPS', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1)),
        ]),
      );
    }
    if (_locationError != null) {
      return GestureDetector(
        onTap: _getLocation,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFEF5350).withOpacity(0.2),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFEF5350).withOpacity(0.5)),
          ),
          child: const Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.location_off_outlined, color: Color(0xFFEF5350), size: 11),
            SizedBox(width: 4),
            Text('GPS Error', style: TextStyle(color: Color(0xFFEF5350), fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1)),
          ]),
        ),
      );
    }
    if (_position != null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF00E676).withOpacity(0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFF00E676).withOpacity(0.35)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.location_on_rounded, color: Color(0xFF00E676), size: 11),
          const SizedBox(width: 4),
          Text('±${_position!.accuracy.toStringAsFixed(0)}m',
              style: const TextStyle(color: Color(0xFF00E676), fontSize: 10, fontWeight: FontWeight.w700)),
        ]),
      );
    }
    return const SizedBox(width: 56);
  }

  Widget _buildBottomPanel() {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 30, sigmaY: 30),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 38),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.70),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
            border: Border(top: BorderSide(color: Colors.white.withOpacity(0.12), width: 1.2)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36, height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(2)),
                ),
                if (_capturing && _livenessStatus != null) ...[
                  const SizedBox(height: 16),
                  const CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  const SizedBox(height: 16),
                  Text(
                    _livenessInstruction,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                ] else if (_submitting || _verifying) ...[
                  const SizedBox(height: 16),
                  const CircularProgressIndicator(color: Colors.white54, strokeWidth: 2),
                  const SizedBox(height: 12),
                  Text(
                    _submitting ? 'Mengunggah...' : 'Memverifikasi wajah...',
                    style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                ] else if (_verifyError != null) ...[
                  // Error panel: wajah tidak cocok atau tidak terdeteksi
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF5350).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFEF5350).withOpacity(0.3)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.face_retouching_off_rounded, color: Color(0xFFEF5350), size: 22),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _verifyError!,
                            style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: () => setState(() => _verifyError = null),
                      icon: const Icon(Icons.camera_alt_rounded, size: 18),
                      label: const Text('Coba Lagi', style: TextStyle(fontWeight: FontWeight.w700)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white.withOpacity(0.12),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                    ),
                  ),
                  if (_verifyAttempts >= 3) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          setState(() {
                            _useServerFallback = true;
                            _verifyError = null;
                          });
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                            content: Text('Menggunakan verifikasi server. Silakan ambil foto ulang.'),
                            backgroundColor: AppColors.amber,
                          ));
                        },
                        icon: const Icon(Icons.cloud_upload_rounded, size: 18),
                        label: const Text('Gunakan Verifikasi Server (Cadangan)', style: TextStyle(fontWeight: FontWeight.w700)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFFFB74D),
                          side: const BorderSide(color: Color(0xFFFFB74D)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ),
                  ],
                ] else if (_photo != null && _verified) ...[
                  // Verified: tampilkan badge dan tombol konfirmasi
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00E676).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF00E676).withOpacity(0.3)),
                    ),
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.verified_user_rounded, color: Color(0xFF00E676), size: 14),
                      SizedBox(width: 6),
                      Text('Wajah terverifikasi',
                          style: TextStyle(color: Color(0xFF00E676), fontSize: 12, fontWeight: FontWeight.w600)),
                    ]),
                  ),
                  Text('Konfirmasi Foto',
                      style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 16),
                  Row(children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _retakePhoto,
                        icon: const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text('Ulangi'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(color: Colors.white.withOpacity(0.3)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        onPressed: _submit,
                        icon: const Icon(Icons.check_rounded, size: 18),
                        label: const Text('Kirim Absen', style: TextStyle(fontWeight: FontWeight.w700)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF8B1F1F),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          elevation: 0,
                        ),
                      ),
                    ),
                  ]),
                ] else ...[
                  // Idle: tampilkan tombol shutter
                  Text('Posisikan wajah Anda di kamera',
                      style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13)),
                  const SizedBox(height: 20),
                  GestureDetector(
                    onTap: _capturePhoto,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 74, height: 74,
                          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3.5)),
                        ),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 60, height: 60,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _capturing ? Colors.white70 : Colors.white,
                          ),
                          child: const Icon(Icons.camera_alt_rounded, color: Colors.black87, size: 26),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text('AMBIL FOTO SELFIE',
                      style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Glass close button ────────────────────────────────────────────────────────
class _GlassIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _GlassIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.12),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: Colors.white.withOpacity(0.18)),
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE SUCCESS SCREEN — Professional result display after successful attendance
// Design: Dark theme, animated green checkmark circle, employee info card
// ══════════════════════════════════════════════════════════════════════════════
class AttendanceSuccessScreen extends StatefulWidget {
  final String mode; // 'in' or 'out'
  final String userName;
  final String userPosition;
  final String userNip;
  final String? userAvatar;
  final String locationName;
  final DateTime checkTime;
  final bool isOffline;

  const AttendanceSuccessScreen({
    super.key,
    required this.mode,
    required this.userName,
    required this.userPosition,
    required this.userNip,
    this.userAvatar,
    required this.locationName,
    required this.checkTime,
    this.isOffline = false,
  });

  @override
  State<AttendanceSuccessScreen> createState() => _AttendanceSuccessScreenState();
}

class _AttendanceSuccessScreenState extends State<AttendanceSuccessScreen>
    with TickerProviderStateMixin {
  late AnimationController _circleController;
  late AnimationController _checkController;
  late AnimationController _fadeController;
  late AnimationController _cardSlideController;
  late AnimationController _pulseController;

  late Animation<double> _circleScale;
  late Animation<double> _checkProgress;
  late Animation<double> _fadeIn;
  late Animation<Offset> _cardSlide;
  late Animation<double> _pulseAnimation;

  bool _isPopped = false;
  bool _canPop = false;

  void _safePop() {
    if (!mounted) return;
    if (_isPopped) return;
    _isPopped = true;
    setState(() {
      _canPop = true;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Navigator.pop(context, true);
      }
    });
  }

  @override
  void initState() {
    super.initState();

    // Circle scale animation
    _circleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _circleScale = CurvedAnimation(
      parent: _circleController,
      curve: Curves.elasticOut,
    );

    // Checkmark draw animation
    _checkController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _checkProgress = CurvedAnimation(
      parent: _checkController,
      curve: Curves.easeInOut,
    );

    // Fade in for text/card
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeIn = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );

    // Card slide up
    _cardSlideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _cardSlide = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _cardSlideController,
      curve: Curves.easeOutCubic,
    ));

    // Pulse glow on circle
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Stagger animations
    _startAnimations();

    // Auto-dismiss after 5 seconds
    Future.delayed(const Duration(seconds: 5), () {
      _safePop();
    });
  }

  Future<void> _startAnimations() async {
    await Future.delayed(const Duration(milliseconds: 200));
    _circleController.forward();
    await Future.delayed(const Duration(milliseconds: 400));
    _checkController.forward();
    HapticFeedback.mediumImpact();
    await Future.delayed(const Duration(milliseconds: 300));
    _fadeController.forward();
    _cardSlideController.forward();
  }

  @override
  void dispose() {
    _circleController.dispose();
    _checkController.dispose();
    _fadeController.dispose();
    _cardSlideController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final modeLabel = widget.mode == 'in' ? 'Masuk' : 'Pulang';
    final timeStr = DateFormat('HH:mm').format(widget.checkTime);
    final dateStr = DateFormat('EEEE, d MMM yyyy', 'id_ID').format(widget.checkTime);

    return PopScope(
      canPop: _canPop,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _safePop();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0A0A0A),
        body: GestureDetector(
          onTap: _safePop,
          behavior: HitTestBehavior.opaque,
          child: SafeArea(
            child: Column(
              children: [
                // ── Top success header ──
                const Spacer(flex: 1),
                FadeTransition(
                  opacity: _fadeIn,
                  child: Text(
                    'Absensi berhasil',
                    style: TextStyle(
                      color: const Color(0xFF00E676).withOpacity(0.9),
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const SizedBox(height: 32),

                // ── Animated checkmark circle ──
                AnimatedBuilder(
                  animation: Listenable.merge([_circleScale, _pulseAnimation]),
                  builder: (context, child) {
                    return ScaleTransition(
                      scale: _circleScale,
                      child: SizedBox(
                        width: 200,
                        height: 200,
                        child: CustomPaint(
                          painter: _SuccessCirclePainter(
                            checkProgress: _checkProgress.value,
                            pulseValue: _pulseAnimation.value,
                          ),
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 32),

                // ── Status text ──
                FadeTransition(
                  opacity: _fadeIn,
                  child: Column(
                    children: [
                      Text(
                        'Absen $modeLabel tercatat',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.3,
                        ),
                      ),
                      if (widget.isOffline) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFA726).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFFFA726).withOpacity(0.3)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.cloud_off_rounded, color: Color(0xFFFFA726), size: 13),
                              SizedBox(width: 5),
                              Text(
                                'Disimpan offline · akan sync otomatis',
                                style: TextStyle(color: Color(0xFFFFA726), fontSize: 11, fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Spacer(flex: 1),

                // ── Employee info card ──
                SlideTransition(
                  position: _cardSlide,
                  child: FadeTransition(
                    opacity: _fadeIn,
                    child: _buildInfoCard(modeLabel, timeStr, dateStr),
                  ),
                ),
                const SizedBox(height: 20),

                // ── Verifikasi ulang button ──
                FadeTransition(
                  opacity: _fadeIn,
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 24),
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(
                      onPressed: _safePop,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        backgroundColor: Colors.white.withValues(alpha: 0.05),
                      ),
                      child: const Text(
                        'Kembali ke Beranda',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),

                // ── Down arrow dismiss indicator ──
                FadeTransition(
                  opacity: _fadeIn,
                  child: GestureDetector(
                    onTap: _safePop,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                      ),
                      child: Icon(
                        Icons.keyboard_arrow_down_rounded,
                        color: Colors.white.withValues(alpha: 0.5),
                        size: 24,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoCard(String modeLabel, String timeStr, String dateStr) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── User header ──
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
            child: Row(
              children: [
                // Avatar
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF8B1F1F), Color(0xFFDC2626)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: widget.userAvatar != null && widget.userAvatar!.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Image.network(
                            '${AppConstants.uploadsUrl}/avatar/${widget.userAvatar}',
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Center(
                              child: Text(
                                _getInitials(widget.userName),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        )
                      : Center(
                          child: Text(
                            _getInitials(widget.userName),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                ),
                const SizedBox(width: 14),
                // Name & Position
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.userName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${widget.userPosition} · NIP ${widget.userNip}',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.45),
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                // Mode badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: widget.mode == 'in'
                        ? const Color(0xFF00E676).withOpacity(0.12)
                        : const Color(0xFFFF6B6B).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: widget.mode == 'in'
                          ? const Color(0xFF00E676).withOpacity(0.3)
                          : const Color(0xFFFF6B6B).withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    modeLabel,
                    style: TextStyle(
                      color: widget.mode == 'in'
                          ? const Color(0xFF00E676)
                          : const Color(0xFFFF6B6B),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // ── Divider ──
          Divider(height: 1, color: Colors.white.withOpacity(0.06)),
          // ── Details rows ──
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
            child: Column(
              children: [
                _DetailRow(
                  icon: Icons.access_time_rounded,
                  label: 'Jam',
                  value: '$timeStr WIB',
                  valueColor: Colors.white,
                ),
                const SizedBox(height: 12),
                _DetailRow(
                  icon: Icons.calendar_today_rounded,
                  label: 'Tanggal',
                  value: dateStr,
                  valueColor: Colors.white,
                ),
                const SizedBox(height: 12),
                _DetailRow(
                  icon: Icons.location_on_rounded,
                  label: 'Lokasi',
                  value: widget.locationName,
                  valueColor: Colors.white,
                ),
              ],
            ),
          ),
          // ── Liveness badge ──
          Divider(height: 1, color: Colors.white.withOpacity(0.06)),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
            child: Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: const Color(0xFF00E676).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.verified_user_rounded,
                    color: Color(0xFF00E676),
                    size: 14,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Wajah terverifikasi · GPS aktif',
                    style: TextStyle(
                      color: const Color(0xFF00E676).withOpacity(0.7),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return parts[0].isNotEmpty ? parts[0][0].toUpperCase() : '?';
  }
}

// ── Detail row inside success card ────────────────────────────────────────────
class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color valueColor;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: Colors.white.withOpacity(0.3), size: 16),
        const SizedBox(width: 10),
        SizedBox(
          width: 70,
          child: Text(
            label,
            style: TextStyle(
              color: Colors.white.withOpacity(0.4),
              fontSize: 13,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }
}

// ── Animated checkmark circle painter for success screen ──────────────────────
class _SuccessCirclePainter extends CustomPainter {
  final double checkProgress;
  final double pulseValue;

  const _SuccessCirclePainter({
    required this.checkProgress,
    required this.pulseValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 6;
    const color = Color(0xFF00E676);

    // Outer pulse glow
    canvas.drawCircle(
      center,
      radius + 4 + pulseValue * 4,
      Paint()
        ..color = color.withOpacity(0.06 + pulseValue * 0.04)
        ..style = PaintingStyle.fill,
    );

    // Main circle border
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = color.withOpacity(0.85)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5,
    );

    // Inner subtle fill
    canvas.drawCircle(
      center,
      radius - 2,
      Paint()
        ..color = color.withOpacity(0.04)
        ..style = PaintingStyle.fill,
    );

    // Animated checkmark
    if (checkProgress > 0) {
      final checkSize = radius * 0.45;
      final startX = center.dx - checkSize * 0.55;
      final startY = center.dy + checkSize * 0.05;
      final midX = center.dx - checkSize * 0.05;
      final midY = center.dy + checkSize * 0.45;
      final endX = center.dx + checkSize * 0.6;
      final endY = center.dy - checkSize * 0.4;

      final path = Path();
      path.moveTo(startX, startY);

      if (checkProgress <= 0.5) {
        // First stroke (going down)
        final t = checkProgress / 0.5;
        path.lineTo(
          startX + (midX - startX) * t,
          startY + (midY - startY) * t,
        );
      } else {
        // Complete first stroke + partial second stroke
        path.lineTo(midX, midY);
        final t = (checkProgress - 0.5) / 0.5;
        path.lineTo(
          midX + (endX - midX) * t,
          midY + (endY - midY) * t,
        );
      }

      canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 6.0
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
    }
  }

  @override
  bool shouldRepaint(_SuccessCirclePainter old) =>
      old.checkProgress != checkProgress || old.pulseValue != pulseValue;
}
