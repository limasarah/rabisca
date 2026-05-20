import 'package:flutter/material.dart';
import 'package:rabisca/screens/home_screen.dart';

void main() {
  runApp(const RabiscaApp());
}

class RabiscaApp extends StatelessWidget {
  const RabiscaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rabisca',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7D5FFF)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF7F2FF),
        textTheme: ThemeData.light().textTheme.apply(
              fontFamily: 'Inter',
            ),
      ),
      home: const HomeScreen(),
    );
  }
}
