import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/app_theme.dart';
import '../../widgets/common_widgets.dart';

class LocationsScreen extends StatefulWidget {
  const LocationsScreen({super.key});

  @override
  State<LocationsScreen> createState() => _LocationsScreenState();
}

class _LocationsScreenState extends State<LocationsScreen> {
  List<Map<String, dynamic>> _locations = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getLocations();
      if (mounted) {
        setState(() {
          _locations = (data['locations'] as List? ?? []).map((l) => Map<String, dynamic>.from(l)).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Lokasi Kantor (Geofence)'),
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF8B1F1F)))
          : RefreshIndicator(
              onRefresh: _load,
              color: const Color(0xFF8B1F1F),
              child: _locations.isEmpty
                  ? const EmptyState(
                      icon: Icons.location_off_rounded,
                      title: 'Tidak ada lokasi terdaftar',
                      subtitle: 'Lokasi geofence absensi dapat ditambahkan dari panel admin web.',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _locations.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (_, i) {
                        final loc = _locations[i];
                        final isActive = loc['is_active'] == true || loc['is_active'] == 1;
                        final radius = loc['radius'] ?? 100;
                        final lat = loc['latitude']?.toString() ?? '-';
                        final lng = loc['longitude']?.toString() ?? '-';

                        return AppCard(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: isActive ? const Color(0xFFF5F0F0) : AppColors.grey100,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: isActive ? const Color(0xFFE0D5D5) : AppColors.border),
                                ),
                                child: Icon(
                                  Icons.location_on_rounded,
                                  color: isActive ? const Color(0xFF8B1F1F) : AppColors.textMuted,
                                  size: 24,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            loc['name'] ?? '-',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 15,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: isActive ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            isActive ? 'Aktif' : 'Nonaktif',
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: isActive ? Colors.green : Colors.red,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        const Icon(Icons.radar_rounded, size: 13, color: AppColors.textMuted),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Radius geofence: $radius meter',
                                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Icon(Icons.my_location_rounded, size: 13, color: AppColors.textMuted),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            'Lat: $lat\nLng: $lng',
                                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted, height: 1.3, fontFamily: 'monospace'),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
