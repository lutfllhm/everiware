import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// GLASS CARD — dipakai HANYA di atas background gelap/gambar
// ─────────────────────────────────────────────────────────────────────────────
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final double radius;
  final double blur;
  final Color? tint;
  final double tintOpacity;
  final VoidCallback? onTap;
  final List<BoxShadow>? shadows;
  final Border? border;

  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.radius = 16,
    this.blur = 12,
    this.tint,
    this.tintOpacity = 0.80,
    this.onTap,
    this.shadows,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: GestureDetector(
          onTap: onTap != null
              ? () {
                  HapticFeedback.lightImpact();
                  onTap!();
                }
              : null,
          child: Container(
            decoration: BoxDecoration(
              color: (tint ?? Colors.white).withValues(alpha: tintOpacity),
              borderRadius: BorderRadius.circular(radius),
              border: border ??
                  Border.all(
                    color: Colors.white.withValues(alpha: 0.30),
                    width: 1,
                  ),
              boxShadow: shadows,
            ),
            padding: padding ?? const EdgeInsets.all(16),
            child: child,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLASS BUTTON — untuk tombol di atas background gelap
// ─────────────────────────────────────────────────────────────────────────────
class GlassButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  final Color? color;
  final bool small;

  const GlassButton({
    super.key,
    required this.label,
    this.icon,
    this.onTap,
    this.color,
    this.small = false,
  });

  @override
  State<GlassButton> createState() => _GlassButtonState();
}

class _GlassButtonState extends State<GlassButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 180),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) => _ctrl.reverse(),
      onTapCancel: () => _ctrl.reverse(),
      onTap: widget.onTap != null
          ? () {
              HapticFeedback.lightImpact();
              widget.onTap!();
            }
          : null,
      child: AnimatedBuilder(
        animation: _scale,
        builder: (_, child) => Transform.scale(scale: _scale.value, child: child),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(50),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: widget.small ? 12 : 16,
                vertical: widget.small ? 6 : 9,
              ),
              decoration: BoxDecoration(
                color: (widget.color ?? Colors.white).withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(50),
                border: Border.all(
                  color: (widget.color ?? Colors.white).withValues(alpha: 0.30),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.icon != null) ...[
                    Icon(
                      widget.icon,
                      color: widget.color ?? Colors.white,
                      size: widget.small ? 13 : 15,
                    ),
                    const SizedBox(width: 5),
                  ],
                  Text(
                    widget.label,
                    style: TextStyle(
                      color: widget.color ?? Colors.white,
                      fontSize: widget.small ? 11 : 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEUMORPHIC CARD
// ─────────────────────────────────────────────────────────────────────────────
class NeumorphicCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final double radius;
  final bool inset;
  final Color? color;
  final VoidCallback? onTap;

  const NeumorphicCard({
    super.key,
    required this.child,
    this.padding,
    this.radius = 16,
    this.inset = false,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bg = color ?? AppColors.surface;
    return GestureDetector(
      onTap: onTap != null
          ? () {
              HapticFeedback.lightImpact();
              onTap!();
            }
          : null,
      child: Container(
        padding: padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(radius),
          boxShadow: inset
              ? []
              : [
                  const BoxShadow(
                    color: Colors.white,
                    blurRadius: 12,
                    spreadRadius: 0,
                    offset: Offset(-3, -3),
                  ),
                  BoxShadow(
                    color: const Color(0xFFD6D3D1).withValues(alpha: 0.7),
                    blurRadius: 12,
                    spreadRadius: 0,
                    offset: const Offset(3, 3),
                  ),
                ],
        ),
        child: child,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADIENT GLASS STAT CARD — untuk dashboard stats
// ─────────────────────────────────────────────────────────────────────────────
class GradientGlassStatCard extends StatelessWidget {
  final String value;
  final String label;
  final IconData icon;
  final LinearGradient gradient;
  final Color color;

  const GradientGlassStatCard({
    super.key,
    required this.value,
    required this.label,
    required this.icon,
    required this.gradient,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: color, size: 19),
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textMuted,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLASS QUICK ACTION — icon dengan warna solid, bukan gradient
// ─────────────────────────────────────────────────────────────────────────────
class GlassQuickAction extends StatefulWidget {
  final String label;
  final IconData icon;
  final LinearGradient gradient;
  final Color color;
  final VoidCallback onTap;

  const GlassQuickAction({
    super.key,
    required this.label,
    required this.icon,
    required this.gradient,
    required this.color,
    required this.onTap,
  });

  @override
  State<GlassQuickAction> createState() => _GlassQuickActionState();
}

class _GlassQuickActionState extends State<GlassQuickAction>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 200),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.90).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) => _ctrl.reverse(),
      onTapCancel: () => _ctrl.reverse(),
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap();
      },
      child: AnimatedBuilder(
        animation: _scale,
        builder: (_, child) => Transform.scale(scale: _scale.value, child: child),
        child: SizedBox(
          width: 72,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: widget.color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: widget.color.withValues(alpha: 0.20),
                    width: 1,
                  ),
                ),
                child: Icon(widget.icon, color: widget.color, size: 24),
              ),
              const SizedBox(height: 7),
              Text(
                widget.label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLASS TIME BOX — check-in/out time display
// ─────────────────────────────────────────────────────────────────────────────
class GlassTimeBox extends StatelessWidget {
  final String label;
  final String time;
  final IconData icon;
  final Color color;
  final LinearGradient gradient;

  const GlassTimeBox({
    super.key,
    required this.label,
    required this.time,
    required this.icon,
    required this.color,
    required this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 14, color: color),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ]),
          const SizedBox(height: 8),
          Text(
            time,
            style: TextStyle(
              color: time == '--:--' ? AppColors.textHint : AppColors.textPrimary,
              fontSize: 26,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
              height: 1.0,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED CHECK-IN BUTTON
// ─────────────────────────────────────────────────────────────────────────────
class AnimatedCheckInButton extends StatefulWidget {
  final bool hasCheckedIn;
  final bool hasCheckedOut;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;

  const AnimatedCheckInButton({
    super.key,
    required this.hasCheckedIn,
    required this.hasCheckedOut,
    required this.onCheckIn,
    required this.onCheckOut,
  });

  @override
  State<AnimatedCheckInButton> createState() => _AnimatedCheckInButtonState();
}

class _AnimatedCheckInButtonState extends State<AnimatedCheckInButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _pressCtrl;
  late Animation<double> _pressAnim;

  @override
  void initState() {
    super.initState();
    _pressCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 200),
    );
    _pressAnim = Tween<double>(begin: 1.0, end: 0.96).animate(
      CurvedAnimation(parent: _pressCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pressCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDone = widget.hasCheckedOut;
    final isCheckedIn = widget.hasCheckedIn && !widget.hasCheckedOut;

    final bgColor = isDone
        ? AppColors.successBg
        : isCheckedIn
            ? const Color(0xFFFFFBEB)
            : AppColors.primary;

    final textColor = isDone
        ? AppColors.success
        : isCheckedIn
            ? AppColors.warning
            : Colors.white;

    final icon = isDone
        ? Icons.check_circle_rounded
        : isCheckedIn
            ? Icons.logout_rounded
            : Icons.fingerprint;

    final label = isDone
        ? 'Sudah Absen Pulang'
        : isCheckedIn
            ? 'Absen Pulang'
            : 'Absen Masuk';

    return GestureDetector(
      onTapDown: isDone ? null : (_) => _pressCtrl.forward(),
      onTapUp: isDone ? null : (_) => _pressCtrl.reverse(),
      onTapCancel: isDone ? null : () => _pressCtrl.reverse(),
      onTap: isDone
          ? null
          : () {
              HapticFeedback.mediumImpact();
              if (isCheckedIn) {
                widget.onCheckOut();
              } else {
                widget.onCheckIn();
              }
            },
      child: AnimatedBuilder(
        animation: _pressAnim,
        builder: (_, child) => Transform.scale(scale: _pressAnim.value, child: child),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: double.infinity,
          height: 58,
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(14),
            border: isDone || isCheckedIn
                ? Border.all(
                    color: isDone ? AppColors.successBorder : const Color(0xFFFDE68A),
                    width: 1.5,
                  )
                : null,
            boxShadow: isDone || isCheckedIn
                ? []
                : [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.30),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: textColor, size: 22),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  color: textColor,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO BACKGROUND — untuk header section, tanpa orbs berlebihan
// ─────────────────────────────────────────────────────────────────────────────
class HeroBackground extends StatelessWidget {
  final Widget child;
  final LinearGradient? gradient;
  final double bottomRadius;

  const HeroBackground({
    super.key,
    required this.child,
    this.gradient,
    this.bottomRadius = 28,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient ?? AppColors.heroGradient,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(bottomRadius),
          bottomRight: Radius.circular(bottomRadius),
        ),
      ),
      child: Stack(
        children: [
          // Satu orb saja, subtle
          Positioned(
            top: -40,
            right: -40,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.05),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION BADGE
// ─────────────────────────────────────────────────────────────────────────────
class PulseBadge extends StatelessWidget {
  final int count;
  final Widget child;

  const PulseBadge({super.key, required this.count, required this.child});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        if (count > 0)
          Positioned(
            top: -3,
            right: -3,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.danger,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              child: Text(
                count > 9 ? '9+' : '$count',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 8,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS CHECKMARK ANIMATION
// ─────────────────────────────────────────────────────────────────────────────
class SuccessCheckmark extends StatefulWidget {
  final double size;
  final Color color;

  const SuccessCheckmark({
    super.key,
    this.size = 80,
    this.color = AppColors.success,
  });

  @override
  State<SuccessCheckmark> createState() => _SuccessCheckmarkState();
}

class _SuccessCheckmarkState extends State<SuccessCheckmark>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 500))..forward();
    _scale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut),
    );
    _opacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: const Interval(0.0, 0.4, curve: Curves.easeOut)),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => FadeTransition(
        opacity: _opacity,
        child: Transform.scale(
          scale: _scale.value,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              color: widget.color.withValues(alpha: 0.10),
              shape: BoxShape.circle,
              border: Border.all(color: widget.color.withValues(alpha: 0.25), width: 2),
            ),
            child: Icon(Icons.check_rounded, color: widget.color, size: widget.size * 0.5),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOSSY 3D ICON
// ─────────────────────────────────────────────────────────────────────────────
class Glossy3dIcon extends StatelessWidget {
  final List<Color> bgGradientColors;
  final Widget child;
  final Color shadowColor;

  const Glossy3dIcon({
    super.key,
    required this.bgGradientColors,
    required this.child,
    required this.shadowColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: bgGradientColors,
          center: const Alignment(-0.3, -0.3),
          radius: 0.85,
        ),
        boxShadow: [
          // Ambient bottom shadow
          BoxShadow(
            color: shadowColor.withValues(alpha: 0.35),
            blurRadius: 10,
            spreadRadius: 1,
            offset: const Offset(0, 5),
          ),
          // Light top-left reflection shadow for claymorphic depth
          BoxShadow(
            color: Colors.white.withValues(alpha: 0.4),
            blurRadius: 6,
            spreadRadius: -1,
            offset: const Offset(-3, -3),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Glossy overlay (diagonal shiny highlight)
          Positioned(
            top: 2,
            left: 6,
            right: 6,
            child: Container(
              height: 24,
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.all(Radius.elliptical(25, 12)),
                gradient: LinearGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.45),
                    Colors.white.withValues(alpha: 0.0),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),
          // Inner badge
          child,
        ],
      ),
    );
  }
}
