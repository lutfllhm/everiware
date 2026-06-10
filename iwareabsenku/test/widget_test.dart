import 'package:flutter_test/flutter_test.dart';
import 'package:iware_absenku/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const IWareApp());
    expect(find.byType(IWareApp), findsOneWidget);
  });
}
