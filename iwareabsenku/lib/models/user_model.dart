class UserModel {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? avatar;
  final String? facePhoto;
  final String role;
  final String? department;
  final String? position;
  final String? employeeId;
  final bool isActive;
  final bool isVerified;
  final bool faceRegistered;
  final String? locationId;
  final String? locationName;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.avatar,
    this.facePhoto,
    required this.role,
    this.department,
    this.position,
    this.employeeId,
    this.isActive = true,
    this.isVerified = false,
    this.faceRegistered = false,
    this.locationId,
    this.locationName,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    email: json['email'] ?? '',
    phone: json['phone'],
    avatar: json['avatar'],
    facePhoto: json['face_photo'],
    role: json['role'] ?? 'employee',
    department: json['department'],
    position: json['position'],
    employeeId: json['employee_id'],
    isActive: json['is_active'] == true || json['is_active'] == 1,
    isVerified: json['is_verified'] == true || json['is_verified'] == 1,
    faceRegistered: (json['face_registered'] == true || json['face_registered'] == 1) &&
                    (json['face_photo'] != null && json['face_photo'].toString().trim().isNotEmpty),
    locationId: json['location_id'],
    locationName: json['location_name'],
  );

  bool get isAdmin => ['superadmin', 'admin', 'hrd'].contains(role);

  /// Gabungan departemen  -  jabatan, untuk ditampilkan di subtitle
  String get deptPosition {
    final parts = [department, position].where((v) => v != null && v.isNotEmpty).map((v) => v!).toList();
    return parts.isEmpty ? '-' : parts.join('  -  ');
  }

  String get roleLabel {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'hrd': return 'HRD';
      default: return 'Karyawan';
    }
  }
}

class AttendanceModel {
  final String id;
  final String userId;
  final String date;
  final DateTime? checkIn;
  final DateTime? checkOut;
  final String? checkInPhoto;
  final String? checkOutPhoto;
  final String status;
  final String? locationName;

  AttendanceModel({
    required this.id,
    required this.userId,
    required this.date,
    this.checkIn,
    this.checkOut,
    this.checkInPhoto,
    this.checkOutPhoto,
    required this.status,
    this.locationName,
  });

  factory AttendanceModel.fromJson(Map<String, dynamic> json) => AttendanceModel(
    id: json['id'] ?? '',
    userId: json['user_id'] ?? '',
    date: json['date'] ?? '',
    checkIn: json['check_in'] != null ? DateTime.parse(json['check_in']) : null,
    checkOut: json['check_out'] != null ? DateTime.parse(json['check_out']) : null,
    checkInPhoto: json['check_in_photo'],
    checkOutPhoto: json['check_out_photo'],
    status: json['status'] ?? 'present',
    locationName: json['location_name'],
  );

  String get statusLabel {
    switch (status) {
      case 'present': return 'Hadir';
      case 'late': return 'Terlambat';
      case 'absent': return 'Tidak Hadir';
      case 'leave': return 'Cuti';
      case 'sick': return 'Sakit';
      default: return status;
    }
  }
}

class LeaveModel {
  final String id;
  final String userId;
  final String type;
  final String startDate;
  final String endDate;
  final int totalDays;
  final String reason;
  final String? attachment;
  final String status;
  final String? reviewNotes;
  final String? reviewerName;
  final String? spvStatus;
  final String? spvName;
  final DateTime createdAt;

  LeaveModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.reason,
    this.attachment,
    required this.status,
    this.reviewNotes,
    this.reviewerName,
    this.spvStatus,
    this.spvName,
    required this.createdAt,
  });

  factory LeaveModel.fromJson(Map<String, dynamic> json) => LeaveModel(
    id: json['id'] ?? '',
    userId: json['user_id'] ?? '',
    type: json['type'] ?? 'annual',
    startDate: json['start_date'] ?? '',
    endDate: json['end_date'] ?? '',
    totalDays: json['total_days'] ?? 0,
    reason: json['reason'] ?? '',
    attachment: json['attachment'],
    status: json['status'] ?? 'pending',
    reviewNotes: json['review_notes'],
    reviewerName: json['reviewer_name'],
    spvStatus: json['spv_status'],
    spvName: json['spv_name'],
    createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : DateTime.now(),
  );

  bool get canCancel => status == 'pending';

  String get typeLabel => type == 'annual' ? 'Cuti Tahunan' : type == 'sick' ? 'Izin Sakit' : type == 'wfh' ? 'WFH' : type == 'dinas' ? 'Dinas Luar' : 'Izin';
  String get statusLabel {
    switch (status) {
      case 'pending': return 'Menunggu';
      case 'approved': return 'Disetujui';
      case 'rejected': return 'Ditolak';
      default: return status;
    }
  }
}

// ── OvertimeModel ─────────────────────────────────────────────────────────────
class OvertimeModel {
  final String id;
  final String date;
  final String startTime;
  final String endTime;
  final int durationMinutes;
  final String reason;
  final String status;
  final String? reviewNotes;
  final String? reviewerName;
  final String? attachment;
  final DateTime createdAt;
  
  // Admin-only fields for displaying employee info
  final String? userName;
  final String? employeeId;
  final String? department;
  final String? position;
  final String? userAvatar;

  OvertimeModel({
    required this.id,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.durationMinutes,
    required this.reason,
    required this.status,
    this.reviewNotes,
    this.reviewerName,
    this.attachment,
    required this.createdAt,
    this.userName,
    this.employeeId,
    this.department,
    this.position,
    this.userAvatar,
  });

  factory OvertimeModel.fromJson(Map<String, dynamic> json) => OvertimeModel(
    id: json['id'] ?? '',
    date: json['date'] ?? '',
    startTime: json['start_time'] ?? '',
    endTime: json['end_time'] ?? '',
    durationMinutes: json['duration_minutes'] ?? 0,
    reason: json['reason'] ?? '',
    status: json['status'] ?? 'pending',
    reviewNotes: json['review_notes'],
    reviewerName: json['reviewer_name'],
    attachment: json['attachment'],
    createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : DateTime.now(),
    userName: json['user_name'],
    employeeId: json['employee_id'],
    department: json['department'],
    position: json['position'],
    userAvatar: json['user_avatar'],
  );

  bool get canCancel => status == 'pending';

  String get durationLabel {
    final h = durationMinutes ~/ 60;
    final m = durationMinutes % 60;
    if (h > 0 && m > 0) return '$h jam $m menit';
    if (h > 0) return '$h jam';
    return '$m menit';
  }

  String get statusLabel {
    switch (status) {
      case 'pending': return 'Menunggu';
      case 'approved': return 'Disetujui';
      case 'rejected': return 'Ditolak';
      default: return status;
    }
  }
}

// ── HolidayModel ──────────────────────────────────────────────────────────────
class HolidayModel {
  final String id;
  final String date;
  final String name;
  final String? description;

  HolidayModel({required this.id, required this.date, required this.name, this.description});

  factory HolidayModel.fromJson(Map<String, dynamic> json) => HolidayModel(
    id: json['id'] ?? '',
    date: json['date'] ?? '',
    name: json['name'] ?? '',
    description: json['description'],
  );
}
