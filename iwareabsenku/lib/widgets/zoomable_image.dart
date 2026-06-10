import 'package:flutter/material.dart';
import '../utils/app_theme.dart';

/// Widget gambar yang bisa di-tap untuk zoom fullscreen.
class ZoomableNetworkImage extends StatelessWidget {
  final String url;
  final String? heroTag;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;

  const ZoomableNetworkImage({
    super.key,
    required this.url,
    this.heroTag,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final tag = heroTag ?? url;
    return GestureDetector(
      onTap: () => _openLightbox(context, url, tag),
      child: Hero(
        tag: tag,
        child: ClipRRect(
          borderRadius: borderRadius ?? BorderRadius.circular(12),
          child: Stack(
            children: [
              Image.network(
                url,
                height: height,
                width: double.infinity,
                fit: fit,
                errorBuilder: (_, __, ___) => Container(
                  height: height ?? 160,
                  color: AppColors.grey100,
                  child: const Center(
                    child: Icon(Icons.broken_image_outlined,
                        color: AppColors.textMuted, size: 32),
                  ),
                ),
                loadingBuilder: (_, child, progress) {
                  if (progress == null) return child;
                  return Container(
                    height: height ?? 160,
                    color: AppColors.grey100,
                    child: const Center(
                      child: CircularProgressIndicator(
                          color: AppColors.primary, strokeWidth: 2),
                    ),
                  );
                },
              ),
              // Zoom hint overlay
              Positioned(
                bottom: 8, right: 8,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.zoom_in_rounded,
                      color: Colors.white, size: 16),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openLightbox(BuildContext context, String url, String tag) {
    Navigator.push(
      context,
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black87,
        pageBuilder: (_, __, ___) => _ImageLightbox(url: url, heroTag: tag),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    );
  }
}

class _ImageLightbox extends StatefulWidget {
  final String url;
  final String heroTag;
  const _ImageLightbox({required this.url, required this.heroTag});

  @override
  State<_ImageLightbox> createState() => _ImageLightboxState();
}

class _ImageLightboxState extends State<_ImageLightbox> {
  final TransformationController _ctrl = TransformationController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.pop(context),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Stack(
          children: [
            // Dismiss on tap outside
            Positioned.fill(child: Container(color: Colors.black87)),
            Center(
              child: Hero(
                tag: widget.heroTag,
                child: InteractiveViewer(
                  transformationController: _ctrl,
                  minScale: 0.5,
                  maxScale: 4.0,
                  child: Image.network(
                    widget.url,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(
                        Icons.broken_image_outlined,
                        color: Colors.white54, size: 64),
                  ),
                ),
              ),
            ),
            // Close button
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 16,
              child: GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close_rounded,
                      color: Colors.white, size: 20),
                ),
              ),
            ),
            // Reset zoom button
            Positioned(
              bottom: MediaQuery.of(context).padding.bottom + 24,
              left: 0, right: 0,
              child: Center(
                child: GestureDetector(
                  onTap: () => _ctrl.value = Matrix4.identity(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text('Reset Zoom',
                        style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
