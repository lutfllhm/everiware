import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../utils/app_theme.dart';
import '../utils/constants.dart';
import 'glass_widgets.dart';

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY BUTTON — solid, bukan gradient. Lebih tegas dan bersih.
// ─────────────────────────────────────────────────────────────────────────────
class PrimaryButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? icon;
  final double height;
  final Color? color;

  const PrimaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.icon,
    this.height = 50,
    this.color,
  });

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 180),
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.97).animate(
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
    final disabled = widget.onPressed == null || widget.isLoading;
    return GestureDetector(
      onTapDown: disabled ? null : (_) => _ctrl.forward(),
      onTapUp: disabled ? null : (_) => _ctrl.reverse(),
      onTapCancel: disabled ? null : () => _ctrl.reverse(),
      onTap: disabled ? null : () {
        HapticFeedback.lightImpact();
        widget.onPressed?.call();
      },
      child: AnimatedBuilder(
        animation: _scaleAnim,
        builder: (_, child) => Transform.scale(scale: _scaleAnim.value, child: child),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: double.infinity,
          height: widget.height,
          decoration: BoxDecoration(
            color: disabled ? AppColors.grey200 : (widget.color ?? AppColors.primary),
            borderRadius: BorderRadius.circular(12),
            boxShadow: disabled
                ? []
                : [
                    BoxShadow(
                      color: (widget.color ?? AppColors.primary).withValues(alpha: 0.25),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
          ),
          child: Center(
            child: widget.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.5),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (widget.icon != null) ...[
                        Icon(widget.icon, size: 18,
                            color: disabled ? AppColors.grey400 : Colors.white),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        widget.text,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.1,
                          color: disabled ? AppColors.grey400 : Colors.white,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECONDARY BUTTON
// ─────────────────────────────────────────────────────────────────────────────
class SecondaryButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final IconData? icon;

  const SecondaryButton({super.key, required this.text, this.onPressed, this.icon});

  @override
  State<SecondaryButton> createState() => _SecondaryButtonState();
}

class _SecondaryButtonState extends State<SecondaryButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 180),
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown: (_) => _ctrl.forward(),
    onTapUp: (_) => _ctrl.reverse(),
    onTapCancel: () => _ctrl.reverse(),
    onTap: widget.onPressed == null ? null : () {
      HapticFeedback.lightImpact();
      widget.onPressed?.call();
    },
    child: AnimatedBuilder(
      animation: _scaleAnim,
      builder: (_, child) => Transform.scale(scale: _scaleAnim.value, child: child),
      child: Container(
        width: double.infinity,
        height: 50,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border, width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (widget.icon != null) ...[
              Icon(widget.icon, size: 18, color: AppColors.textSecondary),
              const SizedBox(width: 8),
            ],
            Text(widget.text,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                )),
          ],
        ),
      ),
    ),
  );
}

// Alias
class GradientButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? icon;
  final LinearGradient? gradient;

  const GradientButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.icon,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) =>
      PrimaryButton(text: text, onPressed: onPressed, isLoading: isLoading, icon: icon);
}

// ─────────────────────────────────────────────────────────────────────────────
// APP CARD — clean, tidak berlebihan
// ─────────────────────────────────────────────────────────────────────────────
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final VoidCallback? onTap;
  final Color? color;
  final double radius;
  final bool hasShadow;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.color,
    this.radius = 16,
    this.hasShadow = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color ?? AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AppColors.border),
        boxShadow: hasShadow
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 12,
                  offset: const Offset(0, 2),
                ),
              ]
            : [],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(radius),
        child: InkWell(
          onTap: onTap != null
              ? () {
                  HapticFeedback.lightImpact();
                  onTap!();
                }
              : null,
          borderRadius: BorderRadius.circular(radius),
          splashColor: AppColors.primary.withValues(alpha: 0.05),
          highlightColor: AppColors.primary.withValues(alpha: 0.02),
          child: Padding(
            padding: padding ?? const EdgeInsets.all(16),
            child: child,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE — pill dengan dot, warna yang jelas
// ─────────────────────────────────────────────────────────────────────────────
class StatusBadge extends StatelessWidget {
  final String status;
  final bool compact;

  const StatusBadge({super.key, required this.status, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final cfg = _config(status);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: cfg['bg'],
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: cfg['border']!, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: cfg['dot'], shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            cfg['label']!,
            style: TextStyle(
              color: cfg['color'],
              fontSize: compact ? 10 : 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _config(String s) {
    switch (s) {
      case 'present':
        return {'label': 'Hadir', 'bg': const Color(0xFFF0FDF4), 'color': const Color(0xFF15803D), 'dot': const Color(0xFF16A34A), 'border': const Color(0xFFBBF7D0)};
      case 'late':
        return {'label': 'Terlambat', 'bg': const Color(0xFFFFFBEB), 'color': const Color(0xFFB45309), 'dot': const Color(0xFFD97706), 'border': const Color(0xFFFDE68A)};
      case 'absent':
        return {'label': 'Tidak Hadir', 'bg': const Color(0xFFFEF2F2), 'color': const Color(0xFFB91C1C), 'dot': const Color(0xFFDC2626), 'border': const Color(0xFFFECACA)};
      case 'leave':
        return {'label': 'Cuti', 'bg': const Color(0xFFEFF6FF), 'color': const Color(0xFF1D4ED8), 'dot': const Color(0xFF3B82F6), 'border': const Color(0xFFBFDBFE)};
      case 'sick':
        return {'label': 'Sakit', 'bg': const Color(0xFFF0F9FF), 'color': const Color(0xFF0369A1), 'dot': const Color(0xFF0EA5E9), 'border': const Color(0xFFBAE6FD)};
      case 'pending':
        return {'label': 'Menunggu', 'bg': const Color(0xFFFFFBEB), 'color': const Color(0xFFB45309), 'dot': const Color(0xFFD97706), 'border': const Color(0xFFFDE68A)};
      case 'approved':
        return {'label': 'Disetujui', 'bg': const Color(0xFFF0FDF4), 'color': const Color(0xFF15803D), 'dot': const Color(0xFF16A34A), 'border': const Color(0xFFBBF7D0)};
      case 'rejected':
        return {'label': 'Ditolak', 'bg': const Color(0xFFFEF2F2), 'color': const Color(0xFFB91C1C), 'dot': const Color(0xFFDC2626), 'border': const Color(0xFFFECACA)};
      case 'present_late':
        return {'label': 'Hadir (Izin Terlambat)', 'bg': const Color(0xFFFFF3E0), 'color': const Color(0xFFE65100), 'dot': const Color(0xFFF57C00), 'border': const Color(0xFFFFE0B2)};
      default:
        return {'label': s, 'bg': AppColors.grey100, 'color': AppColors.grey600, 'dot': AppColors.grey400, 'border': AppColors.grey200};
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — lebih simpel, tidak ada pill background
// ─────────────────────────────────────────────────────────────────────────────
class SectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final Widget? trailing;

  const SectionHeader({super.key, required this.title, this.action, this.onAction, this.trailing});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
              letterSpacing: -0.2,
            ),
          ),
          if (trailing != null)
            trailing!
          else if (action != null)
            GestureDetector(
              onTap: onAction,
              child: Text(
                action!,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER AVATAR
// ─────────────────────────────────────────────────────────────────────────────
class UserAvatar extends StatelessWidget {
  final String name;
  final double size;
  final String? avatarFilename;
  final VoidCallback? onTap;

  const UserAvatar({super.key, required this.name, this.size = 40, this.avatarFilename, this.onTap});

  @override
  Widget build(BuildContext context) {
    final avatarUrl = avatarFilename != null && avatarFilename!.isNotEmpty
        ? '${AppConstants.uploadsUrl}/avatar/$avatarFilename'
        : null;

    Widget avatar = Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0xFF8B1F1F),
      ),
      child: ClipOval(
        child: avatarUrl != null
            ? Image.network(
                avatarUrl,
                width: size,
                height: size,
                fit: BoxFit.cover,
                alignment: Alignment.center,
                errorBuilder: (_, __, ___) => _initials(),
              )
            : _initials(),
      ),
    );

    if (onTap != null) return GestureDetector(onTap: onTap, child: avatar);
    return avatar;
  }

  Widget _initials() => Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * 0.38),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO ROW
// ─────────────────────────────────────────────────────────────────────────────
class InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? iconColor;
  final Color? iconBg;

  const InfoRow({super.key, required this.icon, required this.label, required this.value, this.iconColor, this.iconBg});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg ?? AppColors.grey100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 16, color: iconColor ?? AppColors.textSecondary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 14, color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
            ]),
          ),
        ]),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER BOX
// ─────────────────────────────────────────────────────────────────────────────
class ShimmerBox extends StatefulWidget {
  final double width, height;
  final double radius;

  const ShimmerBox({super.key, required this.width, required this.height, this.radius = 8});

  @override
  State<ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<ShimmerBox> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();
    _anim = Tween<double>(begin: -2, end: 3).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _anim,
        builder: (_, __) => Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(_anim.value - 1, 0),
              end: Alignment(_anim.value, 0),
              colors: const [Color(0xFFF5F5F4), Color(0xFFFAFAF9), Color(0xFFF5F5F4)],
            ),
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CHIP
// ─────────────────────────────────────────────────────────────────────────────
class StatChip extends StatelessWidget {
  final String value, label;
  final Color color;
  final IconData icon;

  const StatChip({super.key, required this.value, required this.label, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 17),
          ),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textMuted, fontWeight: FontWeight.w500)),
        ]),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRADIENT HEADER CARD
// ─────────────────────────────────────────────────────────────────────────────
class GradientHeaderCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final List<Color> colors;
  final EdgeInsets? padding;

  const GradientHeaderCard({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.colors = const [Color(0xFF1D4ED8), Color(0xFF2563EB)],
    this.padding,
  });

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: padding ?? const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: colors.first,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(subtitle!, style: const TextStyle(color: Colors.white70, fontSize: 13)),
              ],
            ]),
          ),
          if (trailing != null) trailing!,
        ]),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
class EmptyState extends StatefulWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsets padding;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.padding = const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
  });

  @override
  State<EmptyState> createState() => _EmptyStateState();
}

class _EmptyStateState extends State<EmptyState> with TickerProviderStateMixin {
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 500))..forward();
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Center(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: Padding(
            padding: widget.padding,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.grey100,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(widget.icon, size: 34, color: AppColors.grey400),
                ),
                const SizedBox(height: 20),
                Text(
                  widget.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                if (widget.subtitle != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    widget.subtitle!,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.4),
                    textAlign: TextAlign.center,
                  ),
                ],
                if (widget.actionLabel != null && widget.onAction != null) ...[
                  const SizedBox(height: 20),
                  SecondaryButton(
                    text: widget.actionLabel!,
                    onPressed: widget.onAction!,
                  ),
                ],
              ],
            ),
          ),
        ),
      );
}

class ProfileHeader extends StatelessWidget {
  final String? title;
  final String? name;
  final String? position;
  final String? department;
  final String? avatarFilename;
  final VoidCallback? onAvatarTap;
  final bool avatarLoading;
  final bool showCameraIcon;
  final bool showBackButton;
  final Widget? bottomWidget;
  final Widget? rightWidget;
  final String? customSubtitle;
  final Widget? customCenterWidget;
  final int? unreadNotif;
  final VoidCallback? onNotifTap;

  const ProfileHeader({
    super.key,
    this.title,
    this.name,
    this.position,
    this.department,
    this.avatarFilename,
    this.onAvatarTap,
    this.avatarLoading = false,
    this.showCameraIcon = false,
    this.showBackButton = false,
    this.bottomWidget,
    this.rightWidget,
    this.customSubtitle,
    this.customCenterWidget,
    this.unreadNotif,
    this.onNotifTap,
  });

  @override
  Widget build(BuildContext context) {
    const double avatarSize = 60.0;

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/images/bg-apk.jpg'),
          fit: BoxFit.cover,
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          gradient: LinearGradient(
            colors: [
              Colors.black.withValues(alpha: 0.65),
              Colors.black.withValues(alpha: 0.4),
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // 1. Top Bar
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    if (showBackButton) ...[
                      IconButton(
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white),
                        onPressed: () => Navigator.pop(context),
                      ),
                      const SizedBox(width: 12),
                    ],
                    if (title != null && title!.isNotEmpty) ...[
                      // Red indicator bar next to title
                      Container(
                        width: 4,
                        height: 18,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFEF5350), Color(0xFFC62828)],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          title!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ),
                    ] else ...[
                      // Logo: EV [iwaa.png] RIWARE
                      RichText(
                        text: TextSpan(
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            fontStyle: FontStyle.italic,
                            fontFamily: 'Usuzi',
                          ),
                          children: [
                            const TextSpan(text: 'EV'),
                            WidgetSpan(
                              alignment: PlaceholderAlignment.middle,
                              child: Padding(
                                padding: const EdgeInsets.only(left: 3, right: 1),
                                child: Image.asset(
                                  'assets/images/iwaa.png',
                                  width: 22,
                                  height: 22,
                                ),
                              ),
                            ),
                            const TextSpan(text: 'RIWARE'),
                          ],
                        ),
                      ),
                      const Spacer(),
                    ],
                    if (rightWidget != null)
                      rightWidget!
                    else if (onNotifTap != null || unreadNotif != null) ...[
                      GestureDetector(
                        onTap: onNotifTap,
                        child: PulseBadge(
                          count: unreadNotif ?? 0,
                          child: Container(
                            width: 38, height: 38,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.12), width: 1),
                            ),
                            child: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 22),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        DateFormat('EEEE, d MMM yyyy', 'id_ID').format(DateTime.now()),
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500),
                      ),
                    ] else ...[
                      // Fallback/standard logo on right
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Image.asset('assets/images/logo.png', width: 28, height: 28),
                          const SizedBox(height: 2),
                          const Text(
                            'EVERIWARE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 7,
                              fontWeight: FontWeight.w900,
                              fontStyle: FontStyle.italic,
                              letterSpacing: 1.0,
                              fontFamily: 'Usuzi',
                            ),
                          ),
                        ],
                      ),
                    ]
                  ],
                ),
                
                // Gap
                if ((name != null && name!.isNotEmpty) || customCenterWidget != null || customSubtitle != null)
                  const SizedBox(height: 18),

                // 2. Profile Horizontal Row
                if (customCenterWidget != null)
                  customCenterWidget!
                else if (name != null && name!.isNotEmpty)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Avatar with camera option
                      Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.center,
                        children: [
                          GestureDetector(
                            onTap: onAvatarTap,
                            child: Container(
                              width: avatarSize,
                              height: avatarSize,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2.0),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 8,
                                    offset: const Offset(0, 4),
                                  )
                                ],
                              ),
                              child: ClipOval(
                                child: avatarLoading
                                    ? const Center(
                                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                      )
                                    : UserAvatar(name: name ?? '', size: avatarSize, avatarFilename: avatarFilename),
                              ),
                            ),
                          ),
                          if (showCameraIcon)
                            Positioned(
                              bottom: -2,
                              right: -2,
                              child: GestureDetector(
                                onTap: onAvatarTap,
                                child: Container(
                                  width: 22,
                                  height: 22,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFF8B1F1F), width: 1.2),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.15),
                                        blurRadius: 3,
                                        offset: const Offset(0, 1.5),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(Icons.camera_alt_rounded, size: 10, color: Color(0xFF8B1F1F)),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      // Details
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name!,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.4,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (position != null && position!.isNotEmpty && position != '-') ...[
                              const SizedBox(height: 3),
                              Text(
                                position!,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.85),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                            if (department != null && department!.isNotEmpty && department != '-') ...[
                              const SizedBox(height: 2),
                              Text(
                                department!,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.65),
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w400,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),

                if (customSubtitle != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    customSubtitle!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
                  ),
                ],

                if (bottomWidget != null) ...[
                  const SizedBox(height: 16),
                  bottomWidget!,
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

