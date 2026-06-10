import 'dart:io';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  late Dio _dio;
  Dio get dio => _dio;
  String get baseUrl => AppConstants.baseUrl;

  void init() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConstants.baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 60),
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString(AppConstants.tokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        handler.next(error);
      },
    ));
  }

  // Helper: handle response dan error dengan aman
  Map<String, dynamic> _handleResponse(Response res) {
    if (res.data is Map<String, dynamic>) return res.data;
    return {'success': false, 'message': 'Response tidak valid'};
  }

  Map<String, dynamic> _handleError(dynamic e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map<String, dynamic>) return data;
      final status = e.response?.statusCode;
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError) {
        return {'success': false, 'message': 'Tidak bisa terhubung ke server. Pastikan backend berjalan dan IP sudah benar.'};
      }
      return {'success': false, 'message': 'Error $status: ${e.message}'};
    }
    return {'success': false, 'message': e.toString()};
  }

  // AUTH
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password, String phone) async {
    try {
      final res = await _dio.post('/auth/register', data: {'name': name, 'email': email, 'password': password, 'phone': phone});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> verifyOTP(String userId, String otp) async {
    try {
      final res = await _dio.post('/auth/verify-otp', data: {'userId': userId, 'otp': otp});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> resendOTP(String userId) async {
    try {
      final res = await _dio.post('/auth/resend-otp', data: {'userId': userId});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  } 

  Future<Map<String, dynamic>> getMe() async {
    try {
      final res = await _dio.get('/auth/me');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> updatePhone(String userId, String phone) async {
    try {
      final res = await _dio.post('/auth/update-phone', data: {'userId': userId, 'phone': phone});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // ATTENDANCE
  Future<Map<String, dynamic>> getTodayAttendance() async {
    try {
      final res = await _dio.get('/attendance/today');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> checkIn(File photo, double lat, double lng, {Map<String, double>? faceBbox, bool localVerified = false}) async {
    try {
      final formData = FormData.fromMap({
        'photo': await MultipartFile.fromFile(photo.path, filename: 'selfie_${DateTime.now().millisecondsSinceEpoch}.jpg'),
        'latitude': lat.toString(),
        'longitude': lng.toString(),
        if (faceBbox != null)
          'face_bbox': '{"x":${faceBbox['x']},"y":${faceBbox['y']},"width":${faceBbox['width']},"height":${faceBbox['height']}}',
        'local_verified': localVerified ? 'true' : 'false',
      });
      final res = await _dio.post('/attendance/check-in',
        data: formData,
        options: Options(headers: {'Content-Type': 'multipart/form-data'}),
      );
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> checkOut(File photo, double lat, double lng, {Map<String, double>? faceBbox, bool localVerified = false}) async {
    try {
      final formData = FormData.fromMap({
        'photo': await MultipartFile.fromFile(photo.path, filename: 'selfie_${DateTime.now().millisecondsSinceEpoch}.jpg'),
        'latitude': lat.toString(),
        'longitude': lng.toString(),
        if (faceBbox != null)
          'face_bbox': '{"x":${faceBbox['x']},"y":${faceBbox['y']},"width":${faceBbox['width']},"height":${faceBbox['height']}}',
        'local_verified': localVerified ? 'true' : 'false',
      });
      final res = await _dio.post('/attendance/check-out',
        data: formData,
        options: Options(headers: {'Content-Type': 'multipart/form-data'}),
      );
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> getMyAttendance({int? month, int? year}) async {
    try {
      final res = await _dio.get('/attendance/my', queryParameters: {
        if (month != null) 'month': month,
        if (year != null) 'year': year,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // LEAVE
  Future<Map<String, dynamic>> getLeaveQuota() async {
    try {
      final res = await _dio.get('/leave/quota');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> getMyLeaves() async {
    try {
      final res = await _dio.get('/leave/my');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> submitLeave(
    String type, String startDate, String endDate, String reason,
    {File? attachment, String? timeStart, String? timeEnd}
  ) async {
    try {
      final map = <String, dynamic>{
        'type': type,
        'start_date': startDate,
        'end_date': endDate,
        'reason': reason,
      };
      if (attachment != null) {
        map['attachment'] = await MultipartFile.fromFile(
          attachment.path,
          filename: 'bukti_${DateTime.now().millisecondsSinceEpoch}.jpg',
        );
      }
      if (timeStart != null) map['time_start'] = timeStart;
      if (timeEnd != null) map['time_end'] = timeEnd;
      final res = await _dio.post('/leave/submit',
        data: FormData.fromMap(map),
        options: Options(headers: {'Content-Type': 'multipart/form-data'}),
      );
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // NOTIFICATIONS
  Future<Map<String, dynamic>> getNotifications() async {
    try {
      final res = await _dio.get('/users/notifications');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<void> markNotificationsRead() async {
    try { await _dio.put('/users/notifications/read'); } catch (_) {}
  }

  Future<void> deleteNotification(String id) async {
    try { await _dio.delete('/users/notifications/$id'); } catch (_) {}
  }

  Future<void> deleteAllNotifications({bool onlyRead = false}) async {
    try {
      await _dio.delete('/users/notifications/all',
        queryParameters: onlyRead ? {'only_read': 'true'} : null,
      );
    } catch (_) {}
  }

  // PROFILE
  Future<Map<String, dynamic>> updateProfile(String name, String phone) async {
    try {
      final res = await _dio.put('/users/profile', data: {'name': name, 'phone': phone});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> updateAvatar(File avatar, String name, String phone) async {
    try {
      final formData = FormData.fromMap({
        'avatar': await MultipartFile.fromFile(avatar.path, filename: 'avatar_${DateTime.now().millisecondsSinceEpoch}.jpg'),
        'name': name,
        'phone': phone,
      });
      final res = await _dio.put('/users/profile',
        data: formData,
        options: Options(headers: {'Content-Type': 'multipart/form-data'}),
      );
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> registerFace(File facePhoto) async {
    try {
      final formData = FormData.fromMap({
        'face_photo': await MultipartFile.fromFile(facePhoto.path, filename: 'face_photo_${DateTime.now().millisecondsSinceEpoch}.jpg'),
      });
      final res = await _dio.put('/users/register-face',
        data: formData,
        options: Options(headers: {'Content-Type': 'multipart/form-data'}),
      );
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> googleAuth(String idToken) async {
    try {
      final res = await _dio.post('/auth/google', data: {'token': idToken});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> changePassword(String oldPass, String newPass) async {    try {
      final res = await _dio.put('/users/change-password', data: {'old_password': oldPass, 'new_password': newPass});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> getDashboardStats() async {
    try {
      final res = await _dio.get('/users/dashboard');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // LOCATIONS
  Future<Map<String, dynamic>> getLocations() async {
    try {
      final res = await _dio.get('/attendance/locations');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // SHIFTS
  Future<Map<String, dynamic>> getMyShift() async {
    try {
      final res = await _dio.get('/shifts/my');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // LEAVE TYPES
  Future<Map<String, dynamic>> getLeaveTypes() async {
    try {
      final res = await _dio.get('/leave-types/active');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // MONTHLY RECAP
  Future<Map<String, dynamic>> getMonthlyRecap({int? month, int? year}) async {
    try {
      final res = await _dio.get('/attendance/my', queryParameters: {
        if (month != null) 'month': month,
        if (year != null) 'year': year,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // FCM TOKEN
  Future<void> saveFcmToken(String token, {String platform = 'android'}) async {
    try {
      await _dio.post('/users/fcm-token', data: {'token': token, 'platform': platform});
    } catch (_) {}
  }

  Future<void> removeFcmToken(String token) async {
    try {
      await _dio.delete('/users/fcm-token', data: {'token': token});
    } catch (_) {}
  }

  // TEAM CALENDAR
  Future<Map<String, dynamic>> getTeamCalendar({String? startDate, String? endDate}) async {
    try {
      final res = await _dio.get('/leave/team-calendar', queryParameters: {
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // SPV PENDING LEAVES
  Future<Map<String, dynamic>> getSpvPendingLeaves() async {
    try {
      final res = await _dio.get('/leave/spv-pending');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> spvReviewLeave(String id, String status, {String? notes}) async {
    try {
      final res = await _dio.put('/leave/spv-review/$id', data: {
        'status': status,
        if (notes != null) 'review_notes': notes,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // HRD: semua pengajuan pending
  Future<Map<String, dynamic>> getAllPendingLeaves() async {
    try {
      final res = await _dio.get('/leave/all', queryParameters: {'status': 'pending'});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // HRD: review (approve/reject) pengajuan
  Future<Map<String, dynamic>> reviewLeave(String id, String status, {String? notes}) async {
    try {
      final res = await _dio.put('/leave/review/$id', data: {
        'status': status,
        if (notes != null) 'review_notes': notes,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // HRD: absensi hari ini semua karyawan
  Future<Map<String, dynamic>> getTodayAllAttendance() async {
    try {
      final now = DateTime.now();
      final res = await _dio.get('/attendance/all', queryParameters: {
        'month': now.month,
        'year': now.year,
        'limit': 100,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // Karyawan: batalkan pengajuan pending
  Future<Map<String, dynamic>> cancelLeave(String id) async {
    try {
      final res = await _dio.delete('/leave/$id');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // OVERTIME
  Future<Map<String, dynamic>> getMyOvertime() async {
    try {
      final res = await _dio.get('/overtime/my');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> submitOvertime(
    String date, String startTime, String endTime, String reason, {File? attachment}
  ) async {
    try {
      final map = <String, dynamic>{
        'date': date,
        'start_time': startTime,
        'end_time': endTime,
        'reason': reason,
      };
      if (attachment != null) {
        map['attachment'] = await MultipartFile.fromFile(
          attachment.path,
          filename: 'lembur_${DateTime.now().millisecondsSinceEpoch}.jpg',
        );
      }
      final res = await _dio.post(
        '/overtime/submit',
        data: FormData.fromMap(map),
        options: Options(headers: {'Content-Type': 'multipart/form-data'}),
      );
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> cancelOvertime(String id) async {
    try {
      final res = await _dio.delete('/overtime/$id');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // HOLIDAYS
  Future<Map<String, dynamic>> getHolidays({int? year}) async {
    try {
      final res = await _dio.get('/holidays', queryParameters: {
        if (year != null) 'year': year,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // FORGOT PASSWORD
  Future<Map<String, dynamic>> forgotPassword(String email) async {
    try {
      final res = await _dio.post('/auth/forgot-password', data: {'email': email});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> verifyResetOTP(String userId, String otp) async {
    try {
      final res = await _dio.post('/auth/verify-reset-otp', data: {'userId': userId, 'otp': otp});
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  Future<Map<String, dynamic>> resetPassword(String userId, String resetToken, String newPassword) async {
    try {
      final res = await _dio.post('/auth/reset-password', data: {
        'userId': userId,
        'resetToken': resetToken,
        'newPassword': newPassword,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // WORK INFO (jam kerja hari ini termasuk Sabtu)
  Future<Map<String, dynamic>> getTodayWorkInfo() async {
    try {
      final res = await _dio.get('/attendance/today');
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // HRD/Admin: Get all overtime requests
  Future<Map<String, dynamic>> getAllOvertime({String? status, int? month, int? year}) async {
    try {
      final res = await _dio.get('/overtime/all', queryParameters: {
        if (status != null) 'status': status,
        if (month != null) 'month': month,
        if (year != null) 'year': year,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // HRD/Admin: Review overtime request
  Future<Map<String, dynamic>> reviewOvertime(String id, String status, {String? notes}) async {
    try {
      final res = await _dio.put('/overtime/review/$id', data: {
        'status': status,
        if (notes != null) 'review_notes': notes,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // HRD/Admin: Get all users/employees
  Future<Map<String, dynamic>> getAllUsers({String? role, String? search}) async {
    try {
      final res = await _dio.get('/users', queryParameters: {
        if (role != null) 'role': role,
        if (search != null) 'search': search,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }

  // HRD/Admin: Broadcast notification
  Future<Map<String, dynamic>> broadcastNotification(String title, String message, {String? type, String? department, String? locationId}) async {
    try {
      final res = await _dio.post('/users/notifications/broadcast', data: {
        'title': title,
        'message': message,
        'type': type ?? 'info',
        if (department != null && department != 'all') 'department': department,
        if (locationId != null && locationId != 'all') 'location_id': locationId,
      });
      return _handleResponse(res);
    } catch (e) { return _handleError(e); }
  }
}
