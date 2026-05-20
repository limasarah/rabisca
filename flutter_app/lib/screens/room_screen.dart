import 'package:flutter/material.dart';
import 'package:rabisca/services/socket_service.dart';
import 'package:rabisca/widgets/drawing_canvas.dart';

class RoomScreen extends StatefulWidget {
  final String nickname;
  final String? roomCode;
  final String mode;

  const RoomScreen({super.key, required this.nickname, this.roomCode, required this.mode});

  @override
  State<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends State<RoomScreen> {
  final SocketService socketService = SocketService();
  bool loading = true;
  String status = '';
  String? errorMessage;
  String roomCode = '----';
  String mode = 'free';
  List<String> players = [];
  List<Map<String, dynamic>> canvasEvents = [];
  List<Map<String, dynamic>> chatMessages = [];

  final List<String> safeMessages = [
    'Muito bom!',
    'Tá perto!',
    'Gostei!',
    'Sua vez!',
    'Vamos juntos!',
    'Que cor linda!',
    'Show de bola!',
  ];

  @override
  void initState() {
    super.initState();
    roomCode = widget.roomCode ?? '----';
    mode = widget.mode;
    setupSocket();
    socketService.connect();
  }

  void setupSocket() {
    socketService.onConnected = () {
      if (widget.roomCode == null) {
        createRoom();
      } else {
        joinRoom();
      }
    };

    socketService.onError = (message) {
      setState(() {
        loading = false;
        errorMessage = message;
      });
    };

    socketService.onRoomState = (data) {
      setState(() {
        loading = false;
        status = 'Sala conectada';
        roomCode = data['code']?.toString() ?? roomCode;
        mode = data['mode']?.toString() ?? mode;
        players = ((data['players'] as List?) ?? []).map((item) {
          if (item is Map && item['nickname'] != null) {
            return item['nickname'].toString();
          }
          return item.toString();
        }).toList();
        canvasEvents = List<Map<String, dynamic>>.from((data['canvasEvents'] ?? []).cast<Map<String, dynamic>>());
      });
    };

    socketService.onRoomUpdate = (data) {
      setState(() {
        players = ((data['players'] as List?) ?? []).map((item) {
          if (item is Map && item['nickname'] != null) {
            return item['nickname'].toString();
          }
          return item.toString();
        }).toList();
        mode = data['mode']?.toString() ?? mode;
      });
    };

    socketService.onRemoteDraw = (data) {
      setState(() {
        canvasEvents.add(Map<String, dynamic>.from(data));
      });
    };

    socketService.onClearCanvas = () {
      setState(() {
        canvasEvents.clear();
      });
    };

    socketService.onChat = (data) {
      setState(() {
        chatMessages.add(data);
      });
    };
  }

  void createRoom() {
    setState(() {
      status = 'Criando sala...';
    });
    socketService.createRoom(widget.nickname, (success, error) {
      if (!success) {
        setState(() {
          loading = false;
          errorMessage = error ?? 'Erro ao criar sala.';
        });
      }
    });
  }

  void joinRoom() {
    setState(() {
      status = 'Entrando na sala...';
    });
    socketService.joinRoom(widget.roomCode!, widget.nickname, (success, error) {
      if (!success) {
        setState(() {
          loading = false;
          errorMessage = error ?? 'Erro ao entrar na sala.';
        });
      }
    });
  }

  @override
  void dispose() {
    socketService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Sala $roomCode'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: loading
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 16),
                    Text(status, style: const TextStyle(fontSize: 16)),
                  ],
                ),
              )
            : errorMessage != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 16)),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text('Voltar'),
                          ),
                        ],
                      ),
                    ),
                  )
                : Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Chip(
                                  label: Text(mode == 'free' ? 'Desenho Livre' : 'Tema & Adivinhação'),
                                  backgroundColor: Colors.purple.shade100,
                                ),
                                const SizedBox(height: 8),
                                Text('${players.length} jogador${players.length == 1 ? '' : 'es'}'),
                              ],
                            ),
                            Text('Olá, ${widget.nickname}', style: const TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: DrawingCanvas(
                          roomCode: roomCode,
                          initialEvents: canvasEvents,
                          onDrawEvent: (event) => socketService.sendDrawEvent(roomCode, event),
                          onClear: () => socketService.clearCanvas(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        child: Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: List.generate(
                            safeMessages.length,
                            (index) => ElevatedButton(
                              onPressed: () => socketService.sendSafeChat(index),
                              child: Text(safeMessages[index]),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (chatMessages.isNotEmpty)
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16.0),
                            child: Container(
                              width: double.infinity,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: Colors.purple.shade100),
                              ),
                              padding: const EdgeInsets.all(12),
                              child: ListView(
                                children: chatMessages
                                    .map((message) => Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                                          child: Text('${message['sender']}: ${message['message']}'),
                                        ))
                                    .toList(),
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
