import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

typedef RoomCallback = void Function(Map<String, dynamic> data);
typedef ChatCallback = void Function(Map<String, dynamic> message);
typedef ErrorCallback = void Function(String message);

class SocketService {
  late IO.Socket socket;
  bool connected = false;

  RoomCallback? onRoomState;
  RoomCallback? onRoomUpdate;
  RoomCallback? onRemoteDraw;
  VoidCallback? onClearCanvas;
  ChatCallback? onChat;
  VoidCallback? onConnected;
  ErrorCallback? onError;

  String get backendUrl {
    if (kIsWeb) return 'http://localhost:4000';
    if (Platform.isAndroid) return 'http://10.0.2.2:4000';
    return 'http://localhost:4000';
  }

  void connect() {
    socket = IO.io(
      backendUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableForceNew()
          .enableAutoConnect()
          .disableReconnection()
          .build(),
    );

    socket.on('connect', (_) {
      connected = true;
      onConnected?.call();
    });

    socket.on('connect_error', (data) {
      onError?.call('Erro de conexão com o servidor.');
    });
    socket.on('error', (data) {
      onError?.call('Erro do socket.');
    });

    socket.on('room-state', (data) {
      if (data is Map) {
        onRoomState?.call(Map<String, dynamic>.from(data));
      }
    });
    socket.on('room-update', (data) {
      if (data is Map) {
        onRoomUpdate?.call(Map<String, dynamic>.from(data));
      }
    });
    socket.on('draw-event', (data) {
      if (data is Map) {
        onRemoteDraw?.call(Map<String, dynamic>.from(data));
      }
    });
    socket.on('clear-canvas', (_) {
      onClearCanvas?.call();
    });
    socket.on('room-chat', (data) {
      if (data is Map) {
        onChat?.call(Map<String, dynamic>.from(data));
      }
    });
  }

  void createRoom(String nickname, void Function(bool success, String? error) callback) {
    if (!connected) {
      callback(false, 'Sem conexão ao servidor.');
      return;
    }
    socket.emitWithAck('create-room', {'nickname': nickname})((data) {
      if (data is Map && data['success'] == true) {
        callback(true, null);
      } else {
        callback(false, data is Map ? data['error']?.toString() : 'Falha ao criar sala.');
      }
    });
  }

  void joinRoom(String code, String nickname, void Function(bool success, String? error) callback) {
    if (!connected) {
      callback(false, 'Sem conexão ao servidor.');
      return;
    }
    socket.emitWithAck('join-room', {'code': code, 'nickname': nickname})((data) {
      if (data is Map && data['success'] == true) {
        callback(true, null);
      } else {
        callback(false, data is Map ? data['error']?.toString() : 'Falha ao entrar na sala.');
      }
    });
  }

  void sendDrawEvent(String roomCode, Map<String, dynamic> event) {
    if (!connected) return;
    socket.emit('draw-event', event);
  }

  void clearCanvas() {
    if (!connected) return;
    socket.emit('clear-canvas');
  }

  void setMode(String mode) {
    if (!connected) return;
    socket.emit('set-mode', {'mode': mode});
  }

  void sendSafeChat(int index) {
    if (!connected) return;
    socket.emit('safe-chat', {'index': index});
  }

  void dispose() {
    socket.dispose();
  }
}
