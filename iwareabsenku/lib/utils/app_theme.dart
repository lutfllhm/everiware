import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// ─────────────────────────────────────────────────────────────────────────────
// COLOR PALETTE — Warm & Human-Centered Design System
// Filosofi: Tidak semua harus gradient. Warna solid yang kuat lebih berkarakter.
// ─────────────────────────────────────────────────────────────────────────────
class AppColors {
  // Brand — Crimson Red
  static const Color primary      = Color(0xFF8B1F1F); // Crimson Red
  static const Color primaryDark  = Color(0xFF4A0808); // Deep Dark Red
  static const Color primaryLight = Color(0xFFEF5350); // Light Coral Red
  static const Color primaryBg    = Color(0xFFFFEBEE); // Soft Pinkish Red
  static const Color primaryBorder= Color(0xFFFFCDD2); // Soft Red Border

  // Accent — amber hangat, bukan kuning neon
  static const Color accent       = Color(0xFFF59E0B); // amber-500
  static const Color accentBg     = Color(0xFFFFFBEB); // amber-50

  // Semantic — warna yang jelas dan tidak ambigu
  static const Color success      = Color(0xFF16A34A); // green-600
  static const Color successBg    = Color(0xFFF0FDF4); // green-50
  static const Color successBorder= Color(0xFFBBF7D0); // green-200
  static const Color teal         = Color(0xFF0D9488); // teal-600
  static const Color teal100      = Color(0xFFCCFBF1);
  static const Color teal50       = Color(0xFFF0FDFA);
  static const Color emerald      = Color(0xFF059669);

  static const Color warning      = Color(0xFFD97706); // amber-600
  static const Color warningBg    = Color(0xFFFFFBEB);
  static const Color amber        = Color(0xFFF59E0B);
  static const Color amber100     = Color(0xFFFEF3C7);

  static const Color info         = Color(0xFF0284C7); // sky-600
  static const Color infoBg       = Color(0xFFF0F9FF);
  static const Color sky          = Color(0xFF0EA5E9);
  static const Color sky100       = Color(0xFFE0F2FE);

  static const Color danger       = Color(0xFFDC2626); // red-600
  static const Color dangerBg     = Color(0xFFFEF2F2); // red-50

  // Backward compat aliases
  static const Color navy900 = Color(0xFF1E3A5F);
  static const Color navy800 = Color(0xFF1E40AF);
  static const Color navy700 = Color(0xFF1D4ED8);
  static const Color navy600 = Color(0xFF2563EB);
  static const Color navy100 = Color(0xFFDBEAFE);
  static const Color navy50  = Color(0xFFEFF6FF);
  static const Color coral   = Color(0xFF1D4ED8);
  static const Color coral100= Color(0xFFDBEAFE);
  static const Color coral50 = Color(0xFFEFF6FF);

  // Neutrals — warm gray, bukan cool gray
  static const Color white   = Colors.white;
  static const Color grey50  = Color(0xFFFAFAF9); // warm
  static const Color grey100 = Color(0xFFF5F5F4);
  static const Color grey200 = Color(0xFFE7E5E4);
  static const Color grey300 = Color(0xFFD6D3D1);
  static const Color grey400 = Color(0xFFA8A29E);
  static const Color grey500 = Color(0xFF78716C);
  static const Color grey600 = Color(0xFF57534E);
  static const Color grey700 = Color(0xFF44403C);
  static const Color grey800 = Color(0xFF292524);
  static const Color grey900 = Color(0xFF1C1917);

  // Text — lebih hangat
  static const Color textPrimary   = Color(0xFF1C1917); // stone-900
  static const Color textSecondary = Color(0xFF57534E); // stone-600
  static const Color textMuted     = Color(0xFFA8A29E); // stone-400
  static const Color textHint      = Color(0xFFD6D3D1); // stone-300

  // Surface — putih bersih, bukan biru-tinted
  static const Color surface     = Color(0xFFF8F7F5); // warm off-white
  static const Color surfaceCard = Colors.white;
  static const Color border      = Color(0xFFE7E5E4); // warm border
  static const Color divider     = Color(0xFFF5F5F4);

  // Glass
  static const Color glassWhite   = Color(0xCCFFFFFF);
  static const Color glassBorder  = Color(0x33FFFFFF);
  static const Color glassOverlay = Color(0x1AFFFFFF);
  static const Color glassDark    = Color(0x1A000000);

  // ── Gradients — dipakai HEMAT, hanya di tempat yang benar-benar perlu ──────
  // Header utama: Crimson Red gradient
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF8B1F1F), Color(0xFFEF5350)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Hero section: Crimson Red gradient
  static const LinearGradient heroGradient = LinearGradient(
    colors: [Color(0xFF4A0808), Color(0xFF8B1F1F), Color(0xFFEF5350)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Login: Crimson Red deep gradient
  static const LinearGradient deepHeroGradient = LinearGradient(
    colors: [Color(0xFF0A0A0A), Color(0xFF4A0808), Color(0xFF8B1F1F)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient navyGradient    = primaryGradient;
  static const LinearGradient coralGradient   = primaryGradient;

  static const LinearGradient darkGradient = LinearGradient(
    colors: [Color(0xFF0F172A), Color(0xFF1E3A5F)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient tealGradient = LinearGradient(
    colors: [Color(0xFF0D9488), Color(0xFF059669)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient skyGradient = LinearGradient(
    colors: [Color(0xFF0284C7), Color(0xFF0EA5E9)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient amberGradient = LinearGradient(
    colors: [Color(0xFFD97706), Color(0xFFF59E0B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient successGradient = tealGradient;
  static const LinearGradient warningGradient = amberGradient;

  // ── Shadows — lebih subtle, tidak terlalu "glow" ──────────────────────────
  static List<BoxShadow> cardShadow({Color? color}) => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.06),
      blurRadius: 16,
      spreadRadius: 0,
      offset: const Offset(0, 4),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.03),
      blurRadius: 4,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> glowShadow(Color color, {double alpha = 0.25}) => [
    BoxShadow(
      color: color.withValues(alpha: alpha),
      blurRadius: 16,
      spreadRadius: 0,
      offset: const Offset(0, 6),
    ),
  ];

  static List<BoxShadow> neumorphicLight({double blur = 20, double spread = 0}) => [
    BoxShadow(
      color: const Color(0xFFFFFFFF),
      blurRadius: blur,
      spreadRadius: spread,
      offset: const Offset(-3, -3),
    ),
    BoxShadow(
      color: const Color(0xFFD6D3D1),
      blurRadius: blur,
      spreadRadius: spread,
      offset: const Offset(3, 3),
    ),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────────────────
class AppTheme {
  static const Color primary       = AppColors.primary;
  static const Color secondary     = AppColors.primaryDark;
  static const Color accent        = AppColors.accent;
  static const Color success       = AppColors.success;
  static const Color warning       = AppColors.warning;
  static const Color danger        = AppColors.danger;
  static const Color info          = AppColors.info;
  static const Color surface       = AppColors.surface;
  static const Color cardBg        = AppColors.surfaceCard;
  static const Color textPrimary   = AppColors.textPrimary;
  static const Color textSecondary = AppColors.textSecondary;
  static const Color textMuted     = AppColors.textMuted;
  static const Color border        = AppColors.border;

  static const LinearGradient primaryGradient = AppColors.primaryGradient;
  static const LinearGradient successGradient = AppColors.tealGradient;
  static const LinearGradient warningGradient = AppColors.amberGradient;
  static const LinearGradient darkGradient    = AppColors.darkGradient;

  static ThemeData get lightTheme {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.light,
        primary: AppColors.primary,
        onPrimary: Colors.white,
        surface: AppColors.surface,
      ),
    );
    return base.copyWith(
      textTheme: GoogleFonts.interTextTheme(base.textTheme),
      scaffoldBackgroundColor: AppColors.surface,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        shadowColor: AppColors.border,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
          letterSpacing: -0.3,
        ),
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        surfaceTintColor: Colors.transparent,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.grey50,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        labelStyle: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 14),
        hintStyle: GoogleFonts.inter(color: AppColors.textHint, fontSize: 14),
        prefixIconColor: AppColors.textMuted,
        floatingLabelStyle: GoogleFonts.inter(
          color: AppColors.primary,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surfaceCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
        margin: EdgeInsets.zero,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.textMuted,
        indicatorColor: AppColors.primary,
        indicatorSize: TabBarIndicatorSize.label,
        labelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
        dividerColor: AppColors.border,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.grey900,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        contentTextStyle: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: Colors.white,
        ),
        elevation: 4,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: 8,
        shadowColor: Colors.black.withValues(alpha: 0.08),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        elevation: 8,
      ),
      splashFactory: InkRipple.splashFactory,
    );
  }

  static ThemeData get adminTheme {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF8B1F1F),
        brightness: Brightness.light,
        primary: const Color(0xFF8B1F1F),
        onPrimary: Colors.white,
        surface: AppColors.surface,
      ),
    );
    return base.copyWith(
      textTheme: GoogleFonts.interTextTheme(base.textTheme),
      scaffoldBackgroundColor: AppColors.surface,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        shadowColor: AppColors.border,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
          letterSpacing: -0.3,
        ),
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        surfaceTintColor: Colors.transparent,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.grey50,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF8B1F1F), width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        labelStyle: GoogleFonts.inter(color: AppColors.textMuted, fontSize: 14),
        hintStyle: GoogleFonts.inter(color: AppColors.textHint, fontSize: 14),
        prefixIconColor: AppColors.textMuted,
        floatingLabelStyle: GoogleFonts.inter(
          color: const Color(0xFF8B1F1F),
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF8B1F1F),
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surfaceCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
        margin: EdgeInsets.zero,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: const Color(0xFF8B1F1F),
        unselectedLabelColor: AppColors.textMuted,
        indicatorColor: const Color(0xFF8B1F1F),
        indicatorSize: TabBarIndicatorSize.label,
        labelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
        dividerColor: AppColors.border,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.grey900,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        contentTextStyle: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: Colors.white,
        ),
        elevation: 4,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: 8,
        shadowColor: Colors.black.withValues(alpha: 0.08),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        elevation: 8,
      ),
      splashFactory: InkRipple.splashFactory,
    );
  }

  static ThemeData get darkTheme => lightTheme;
}
