import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'services/auth_provider.dart';
import 'services/api_service.dart';
import 'services/fcm_service.dart';
import 'utils/app_theme.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/intro_screen.dart';
import 'screens/auth/welcome_screen.dart';
import 'screens/employee/home_screen.dart';
import 'screens/admin/admin_screen.dart';
import 'screens/admin/leave_approval_screen.dart';
import 'screens/admin/overtime_approval_screen.dart';
import 'screens/admin/today_attendance_screen.dart';
import 'screens/admin/team_calendar_screen.dart';
import 'screens/admin/employee_directory_screen.dart';
import 'screens/admin/locations_screen.dart';
import 'screens/admin/broadcast_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID', null);
  ApiService().init();

  // Lock portrait orientation
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Init FCM dengan callback navigasi saat notif di-tap
  await FcmService().init(onTap: (payload) {
    if (payload == null) return;
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return;
    if (payload == 'attendance' || payload.startsWith('leave:') || payload.startsWith('overtime:')) {
      navigatorKey.currentState?.pushNamedAndRemoveUntil('/home', (r) => false);
    }
  });

    // Status bar transparan, nav bar putih
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.dark,
    systemNavigationBarDividerColor: Colors.transparent,
  ));

  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: const IWareApp(),
    ),
  );
}

class IWareApp extends StatelessWidget {
  const IWareApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isAdminUser = auth.isAuthenticated && auth.isAdmin;
    final activeTheme = isAdminUser ? AppTheme.adminTheme : AppTheme.lightTheme;

    return MaterialApp(
      title: 'Everiware',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      theme: activeTheme,
      darkTheme: isAdminUser ? AppTheme.adminTheme : AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const _SplashRouter(),
      onGenerateRoute: (settings) {
        Widget page;
        switch (settings.name) {
          case '/login':
            page = const LoginScreen();
            break;
          case '/welcome':
            page = const WelcomeScreen(isReadOnly: false);
            break;
          case '/intro':
            page = const IntroScreen();
            break;
          case '/home':
            page = const HomeScreen();
            break;
          case '/admin':
          case '/hrd':
            page = const AdminScreen();
            break;
          case '/admin/leave-approval':
            page = const LeaveApprovalScreen();
            break;
          case '/admin/overtime-approval':
            page = const OvertimeApprovalScreen();
            break;
          case '/admin/today-attendance':
            page = const TodayAttendanceScreen();
            break;
          case '/admin/team-calendar':
            page = const TeamCalendarScreen();
            break;
          case '/admin/employee-directory':
            page = const EmployeeDirectoryScreen();
            break;
          case '/admin/locations':
            page = const LocationsScreen();
            break;
          case '/admin/broadcast':
            page = const BroadcastScreen();
            break;
          default:
            return null;
        }
        return PageRouteBuilder(
          settings: settings,
          pageBuilder: (context, animation, secondaryAnimation) => page,
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: animation,
              child: child,
            );
          },
          transitionDuration: const Duration(milliseconds: 400),
        );
      },
    );
  }
}

class _SplashRouter extends StatefulWidget {
  const _SplashRouter();
  @override
  State<_SplashRouter> createState() => _SplashRouterState();
}

class _SplashRouterState extends State<_SplashRouter> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _logoScale;
  late Animation<double> _logoOpacity;
  late Animation<double> _textOpacity;
  late Animation<double> _textSlide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );

    _logoScale = Tween<double>(begin: 0.7, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.6, curve: Curves.easeOutBack),
      ),
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.4, curve: Curves.easeIn),
      ),
    );

    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.4, 0.8, curve: Curves.easeIn),
      ),
    );

    _textSlide = Tween<double>(begin: -2.0, end: -12.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.4, 0.8, curve: Curves.easeOutCubic),
      ),
    );

    _controller.forward();
    _navigate();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _navigate() async {
    final auth = context.read<AuthProvider>();
    await auth.loadFromStorage();
    // Memberikan waktu agar animasi selesai dimainkan penuh sebelum navigasi
    await Future.delayed(const Duration(milliseconds: 2200));
    if (!mounted) return;
    if (auth.isAuthenticated) {
      Navigator.pushReplacementNamed(context, auth.isAdmin ? '/admin' : '/home');
    } else {
      final prefs = await SharedPreferences.getInstance();
      final hasSeenWelcome = prefs.getBool('has_seen_welcome') ?? false;
      if (hasSeenWelcome) {
        Navigator.pushReplacementNamed(context, '/login');
      } else {
        Navigator.pushReplacementNamed(context, '/welcome');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          image: DecorationImage(
            image: AssetImage('assets/images/bg-loading.jpg'),
            fit: BoxFit.cover,
          ),
        ),
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 4),
                // Logo dengan animasi skala & opasitas
                Opacity(
                  opacity: _logoOpacity.value,
                  child: Transform.scale(
                    scale: _logoScale.value,
                    child: Image.asset(
                      'assets/images/iwaa.png',
                      width: 130,
                      height: 130,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                const SizedBox(height: 0),
                // Teks brand dengan animasi geser ke atas & opasitas
                Opacity(
                  opacity: _textOpacity.value,
                  child: Transform.translate(
                    offset: Offset(0, _textSlide.value),
                    child: const Text(
                      'EVERIWARE',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                        fontStyle: FontStyle.italic,
                        fontFamily: 'Usuzi',
                      ),
                    ),
                  ),
                ),
                const Spacer(flex: 4),
                // Indikator loading muncul lembut di akhir
                Opacity(
                  opacity: _textOpacity.value,
                  child: const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: Colors.white24,
                      strokeWidth: 2,
                    ),
                  ),
                ),
                const Spacer(flex: 1),
              ],
            );
          },
        ),
      ),
    );
  }
}
