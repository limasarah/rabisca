import 'package:flutter/material.dart';
import 'package:rabisca/screens/room_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final nicknameController = TextEditingController();
  final codeController = TextEditingController();

  void _createRoom() {
    final nickname = nicknameController.text.trim().isEmpty
        ? 'Amigo'
        : nicknameController.text.trim();
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RoomScreen(
          nickname: nickname,
          roomCode: null,
          mode: 'free',
        ),
      ),
    );
  }

  void _joinRoom() {
    final nickname = nicknameController.text.trim().isEmpty
        ? 'Amigo'
        : nicknameController.text.trim();
    final roomCode = codeController.text.trim();
    if (roomCode.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Digite o código da sala para entrar.')),
      );
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => RoomScreen(
          nickname: nickname,
          roomCode: roomCode.toUpperCase(),
          mode: 'free',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(18.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              const Text(
                'Rabisca',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Desenhe com a família em salas privadas e seguras.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: Colors.black87),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: nicknameController,
                decoration: InputDecoration(
                  labelText: 'Apelido',
                  hintText: 'Ex: Nina',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(20)),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: codeController,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  labelText: 'Código da sala',
                  hintText: 'AB-12',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(20)),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: _createRoom,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                ),
                child: const Text('Criar sala', style: TextStyle(fontSize: 18)),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _joinRoom,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                ),
                child: const Text('Entrar em sala', style: TextStyle(fontSize: 18)),
              ),
              const Spacer(),
              const Text(
                'Sem login. Sem e-mail. Sem dados pessoais.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
