import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/realtime_service.dart';
import '../utils/constants.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  String? _token;
  bool _isLoading = false;

  UserModel? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _token != null && _user != null;
  bool get isAdmin => _user?.isAdmin ?? false;

  Future<void> loadFromStorage() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(AppConstants.tokenKey);
    final userJson = prefs.getString(AppConstants.userKey);
    if (userJson != null) {
      _user = UserModel.fromJson(jsonDecode(userJson));
    }
    notifyListeners();

    if (_token != null) {
      refreshProfile();
      RealtimeService().connect(_token!);
    }
  }

  Future<void> refreshProfile() async {
    if (_token == null) return;
    try {
      final res = await ApiService().getMe();
      if (res['success'] == true && res['user'] != null) {
        _user = UserModel.fromJson(res['user']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConstants.userKey, jsonEncode(res['user']));
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error refreshing profile: $e');
    }
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();
    try {
      final data = await ApiService().login(email, password);
      if (data['success'] == true) {
        await _saveAuth(data);
      }
      return data;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password, String phone) async {
    _isLoading = true;
    notifyListeners();
    try {
      return await ApiService().register(name, email, password, phone);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> verifyOTP(String userId, String otp) async {
    _isLoading = true;
    notifyListeners();
    try {
      final data = await ApiService().verifyOTP(userId, otp);
      if (data['success'] == true) {
        await _saveAuth(data);
      }
      return data;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _saveAuth(Map<String, dynamic> data) async {
    _token = data['token'];
    _user = UserModel.fromJson(data['user']);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.tokenKey, _token!);
    await prefs.setString(AppConstants.userKey, jsonEncode(data['user']));
    notifyListeners();
    RealtimeService().connect(_token!);
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.tokenKey);
    await prefs.remove(AppConstants.userKey);
    notifyListeners();
    RealtimeService().disconnect();
  }

  Future<Map<String, dynamic>> googleLogin(String idToken) async {
    _isLoading = true;
    notifyListeners();
    try {
      final data = await ApiService().googleAuth(idToken);
      if (data['success'] == true && data['needPhone'] != true) {
        await _saveAuth(data);
      }
      return data;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> updatePhone(String userId, String phone) async {
    _isLoading = true;
    notifyListeners();
    try {
      final data = await ApiService().updatePhone(userId, phone);
      if (data['success'] == true) {
        await _saveAuth(data);
      }
      return data;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void updateUser(UserModel user) {
    _user = user;
    notifyListeners();
  }
}
