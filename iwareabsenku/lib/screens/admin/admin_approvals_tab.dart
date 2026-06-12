import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../services/auth_provider.dart';
import '../../widgets/common_widgets.dart';
import 'leave_approval_screen.dart';
import 'overtime_approval_screen.dart';

class AdminApprovalsTab extends StatefulWidget {
  const AdminApprovalsTab({super.key});

  @override
  State<AdminApprovalsTab> createState() => _AdminApprovalsTabState();
}

class _AdminApprovalsTabState extends State<AdminApprovalsTab>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F8FD),
        body: NestedScrollView(
          headerSliverBuilder: (_, __) => [
            SliverToBoxAdapter(
              child: ProfileHeader(
                title: 'Riwayat',
                name: user?.name,
                position: user?.position ?? user?.roleLabel,
                department: user?.department ?? user?.deptPosition,
                avatarFilename: user?.avatar,
                bottomWidget: TabBar(
                  controller: _tabCtrl,
                  labelColor: Colors.white,
                  unselectedLabelColor: Colors.white60,
                  indicatorColor: const Color(0xFFEF5350),
                  indicatorWeight: 3,
                  indicatorSize: TabBarIndicatorSize.label,
                  dividerColor: Colors.transparent,
                  labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                  unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  tabs: const [
                    Tab(text: 'Izin & Cuti'),
                    Tab(text: 'Lembur'),
                  ],
                ),
              ),
            ),
          ],
          body: TabBarView(
            controller: _tabCtrl,
            physics: const NeverScrollableScrollPhysics(),
            children: const [
              LeaveApprovalScreen(showAppBar: false),
              OvertimeApprovalScreen(showAppBar: false),
            ],
          ),
        ),
      ),
    );
  }
}
