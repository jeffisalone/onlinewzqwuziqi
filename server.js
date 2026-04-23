import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

const rooms = new Map(); // roomId -> { players: [ws1, ws2], board: [], nextTurn: 1 }

wss.on('connection', (ws) => {
  console.log('新客户端已连接');
  let currentRoomId = null;
  let playerColor = 0; // 1: 黑棋, 2: 白棋

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'join') {
        const { roomId } = message;
        currentRoomId = roomId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, { players: [ws] });
          playerColor = 1; // 第一个加入的是黑棋
          ws.send(JSON.stringify({ type: 'joined', color: 1, roomId }));
          console.log(`房间 ${roomId} 创建，玩家 A (黑棋) 加入`);
        } else {
          const room = rooms.get(roomId);
          if (room.players.length < 2) {
            room.players.push(ws);
            playerColor = 2; // 第二个加入的是白棋
            ws.send(JSON.stringify({ type: 'joined', color: 2, roomId }));
            console.log(`玩家 B (白棋) 加入房间 ${roomId}`);
            // 通知双方游戏开始
            room.players.forEach(p => p.send(JSON.stringify({ type: 'start', turn: 1 })));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: '该房间已满' }));
          }
        }
      }

      if (message.type === 'move') {
        const room = rooms.get(currentRoomId);
        if (room && room.players.includes(ws)) {
          // 广播落子信息给房间内所有人
          room.players.forEach(p => {
            p.send(JSON.stringify({ 
              type: 'move', 
              row: message.row, 
              col: message.col, 
              color: playerColor 
            }));
          });
        }
      }

      if (message.type === 'reset') {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.players.forEach(p => p.send(JSON.stringify({ type: 'reset' })));
        }
      }
    } catch (e) {
      console.error('处理消息出错:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      room.players = room.players.filter(p => p !== ws);
      console.log(`玩家离开房间 ${currentRoomId}`);
      if (room.players.length === 0) {
        rooms.delete(currentRoomId);
        console.log(`房间 ${currentRoomId} 已释放`);
      } else {
        room.players.forEach(p => p.send(JSON.stringify({ type: 'opponentLeft' })));
      }
    }
  });
});

console.log('WebSocket 服务已启动: ws://localhost:8080');
