import 'package:flutter/material.dart';

class DrawingCanvas extends StatefulWidget {
  final String roomCode;
  final List<Map<String, dynamic>> initialEvents;
  final void Function(Map<String, dynamic>) onDrawEvent;
  final VoidCallback onClear;

  const DrawingCanvas({
    super.key,
    required this.roomCode,
    required this.initialEvents,
    required this.onDrawEvent,
    required this.onClear,
  });

  @override
  State<DrawingCanvas> createState() => _DrawingCanvasState();
}

class _DrawingCanvasState extends State<DrawingCanvas> {
  final List<Map<String, dynamic>> events = [];
  Offset? lastPoint;

  @override
  void initState() {
    super.initState();
    events.addAll(widget.initialEvents);
  }

  @override
  void didUpdateWidget(covariant DrawingCanvas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialEvents != oldWidget.initialEvents) {
      events
        ..clear()
        ..addAll(widget.initialEvents);
    }
  }

  Color _parseColor(String value) {
    final hex = value.replaceAll('#', '');
    final normalized = hex.length == 6 ? 'FF$hex' : hex;
    return Color(int.parse(normalized, radix: 16));
  }

  void _addEvent(Map<String, dynamic> event) {
    setState(() {
      events.add(event);
    });
    widget.onDrawEvent(event);
  }

  Offset _localPosition(DragUpdateDetails details) {
    final box = context.findRenderObject() as RenderBox;
    return box.globalToLocal(details.globalPosition);
  }

  void _onPanUpdate(DragUpdateDetails details) {
    final point = _localPosition(details);
    if (lastPoint == null) {
      lastPoint = point;
      return;
    }
    final event = {
      'room': widget.roomCode,
      'tool': 'brush',
      'color': '#7D5FFF',
      'thickness': 6,
      'from': {'x': lastPoint!.dx, 'y': lastPoint!.dy},
      'to': {'x': point.dx, 'y': point.dy},
    };
    _addEvent(event);
    lastPoint = point;
  }

  void _onPanEnd(DragEndDetails details) {
    lastPoint = null;
  }

  void _clearCanvas() {
    setState(() {
      events.clear();
    });
    widget.onClear();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GestureDetector(
          onPanUpdate: _onPanUpdate,
          onPanEnd: _onPanEnd,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: CustomPaint(
              painter: _CanvasPainter(events, _parseColor),
              child: const SizedBox(height: 360),
            ),
          ),
        ),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: _clearCanvas,
          style: ElevatedButton.styleFrom(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          ),
          child: const Text('Limpar Tudo'),
        ),
      ],
    );
  }
}

class _CanvasPainter extends CustomPainter {
  final List<Map<String, dynamic>> events;
  final Color Function(String value) parseColor;

  _CanvasPainter(this.events, this.parseColor);

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in events) {
      final from = stroke['from'];
      final to = stroke['to'];
      if (from is Map && to is Map) {
        final paint = Paint()
          ..color = stroke['tool'] == 'eraser'
              ? Colors.white
              : parseColor(stroke['color']?.toString() ?? '#7D5FFF')
          ..strokeCap = StrokeCap.round
          ..strokeWidth = (stroke['thickness'] is num ? (stroke['thickness'] as num).toDouble() : 6.0)
          ..style = PaintingStyle.stroke;

        canvas.drawLine(
          Offset((from['x'] as num).toDouble(), (from['y'] as num).toDouble()),
          Offset((to['x'] as num).toDouble(), (to['y'] as num).toDouble()),
          paint,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _CanvasPainter oldDelegate) {
    return oldDelegate.events.length != events.length;
  }
}
