import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../utils/constants.dart';

class RealtimeService {
  static final RealtimeService _instance = RealtimeService._internal();
  factory RealtimeService() => _instance;
  RealtimeService._internal();

  HttpClient? _client;
  HttpClientRequest? _request;
  HttpClientResponse? _response;
  StreamSubscription? _subscription;
  bool _isConnected = false;
  
  final _eventController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get events => _eventController.stream;

  void connect(String token) async {
    if (_isConnected) return;
    _isConnected = true;
    
    debugPrint('🔌 Connecting to Realtime SSE Server...');
    try {
      _client = HttpClient();
      // Disable timeout since this is a long-lived connection
      _client!.connectionTimeout = null;

      final urlStr = '${AppConstants.baseUrl}/realtime/stream?token=$token';
      _request = await _client!.getUrl(Uri.parse(urlStr));
      _request!.headers.set('Accept', 'text/event-stream');
      _request!.headers.set('Cache-Control', 'no-cache');
      
      _response = await _request!.close();
      if (_response!.statusCode == 200) {
        debugPrint('🔌 Connected to Realtime SSE Server successfully!');
        
        _subscription = _response!
            .transform(utf8.decoder)
            .transform(const LineSplitter())
            .listen((line) {
          if (line.startsWith('data:')) {
            try {
              final jsonStr = line.substring(5).trim();
              if (jsonStr.isNotEmpty) {
                final data = jsonDecode(jsonStr);
                debugPrint('🔌 Realtime Event: $data');
                _eventController.add(Map<String, dynamic>.from(data));
              }
            } catch (e) {
              debugPrint('Error parsing SSE line: $e');
            }
          }
        }, onError: (err) {
          debugPrint('🔌 Realtime SSE Stream error: $err');
          _reconnect(token);
        }, onDone: () {
          debugPrint('🔌 Realtime SSE Stream closed');
          _reconnect(token);
        });
      } else {
        debugPrint('🔌 SSE connection failed with status code: ${_response!.statusCode}');
        _reconnect(token);
      }
    } catch (e) {
      debugPrint('🔌 SSE connection exception: $e');
      _reconnect(token);
    }
  }

  void _reconnect(String token) {
    if (!_isConnected) return;
    disconnect();
    Future.delayed(const Duration(seconds: 5), () {
      connect(token);
    });
  }

  void disconnect() {
    _isConnected = false;
    _subscription?.cancel();
    _subscription = null;
    _request?.abort();
    _request = null;
    _client?.close();
    _client = null;
    debugPrint('🔌 Disconnected from Realtime SSE Server.');
  }
}
