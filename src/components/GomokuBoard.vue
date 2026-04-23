<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { BOARD_SIZE, type Cell, type Player, checkWinner } from "../logic/gomoku";

const board = reactive<Cell[][]>(
  Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0))
);

const currentPlayer = ref<Player>(1); 
const winner = ref<Player | null>(null);
const lastMove = ref<{ row: number; col: number } | null>(null);

// WebSocket 状态
const socket = ref<WebSocket | null>(null);
const roomIdInput = ref("");
const currentRoomId = ref("");
const myPlayerColor = ref<Player | 0>(0); // 我的颜色：1黑，2白
const isGameStarted = ref(false);
const errorMsg = ref("");

// 判断是否是星位
const isStarPoint = (r: number, c: number) => {
  const stars = [3, 7, 11];
  if (r === 7 && c === 7) return true;
  return (r === 3 || r === 11) && (c === 3 || c === 11);
};

const connectWS = () => {
  if (!roomIdInput.value) return;
  
  socket.value = new WebSocket('ws://localhost:8080');

  socket.value.onopen = () => {
    socket.value?.send(JSON.stringify({
      type: 'join',
      roomId: roomIdInput.value
    }));
  };

  socket.value.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'joined':
        myPlayerColor.value = data.color;
        currentRoomId.value = data.roomId;
        break;
      case 'start':
        isGameStarted.value = true;
        break;
      case 'move':
        applyMove(data.row, data.col, data.color);
        break;
      case 'reset':
        resetBoardState();
        break;
      case 'opponentLeft':
        errorMsg.value = "对方已断开连接";
        isGameStarted.value = false;
        break;
      case 'error':
        errorMsg.value = data.message;
        break;
    }
  };
};

const applyMove = (row: number, col: number, color: Player) => {
  board[row][col] = color;
  lastMove.value = { row, col };
  const winPlayer = checkWinner(board, row, col);
  if (winPlayer) {
    winner.value = winPlayer;
  } else {
    currentPlayer.value = color === 1 ? 2 : 1;
  }
};

const handleCellClick = (row: number, col: number) => {
  // 基础判断
  if (board[row][col] !== 0 || winner.value || !isGameStarted.value) return;
  // 是否轮到我
  if (currentPlayer.value !== myPlayerColor.value) return;

  // 发送落子给服务器
  socket.value?.send(JSON.stringify({
    type: 'move',
    row,
    col
  }));
};

const resetGame = () => {
  socket.value?.send(JSON.stringify({ type: 'reset' }));
};

const resetBoardState = () => {
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      board[i][j] = 0;
    }
  }
  currentPlayer.value = 1;
  winner.value = null;
  lastMove.value = null;
  errorMsg.value = "";
};

onUnmounted(() => {
  socket.value?.close();
});
</script>

<template>
  <div class="game-layout">
    <!-- 加入房间界面 -->
    <div v-if="!currentRoomId" class="room-setup">
      <div class="setup-card">
        <h1>五子棋在线对战</h1>
        <div class="input-group">
          <input 
            v-model="roomIdInput" 
            placeholder="输入房间 ID" 
            @keyup.enter="connectWS"
          />
          <button @click="connectWS">加入/创建房间</button>
        </div>
        <p class="error-tip" v-if="errorMsg">{{ errorMsg }}</p>
      </div>
    </div>

    <div v-else class="gomoku-container">
      <div class="room-info">房间 ID: {{ currentRoomId }} | 你是: {{ myPlayerColor === 1 ? '黑棋' : '白棋' }}</div>
      
      <div class="status">
        <div v-if="!isGameStarted" class="waiting-text">等待对手加入...</div>
        <div v-else-if="winner" class="winner-text">
          {{ winner === myPlayerColor ? "🎉 恭喜你赢了！" : "对手获得了胜利！" }}
        </div>
        <div v-else>
          {{ currentPlayer === myPlayerColor ? "当前轮到: 你落子" : "对方正在思考..." }}
          <span :class="{ 'player-black': currentPlayer === 1, 'player-white': currentPlayer === 2 }">
            ({{ currentPlayer === 1 ? "黑棋" : "白棋" }})
          </span>
        </div>
      </div>

      <div class="board-wrapper">
        <div class="board" :class="{ 'not-my-turn': currentPlayer !== myPlayerColor || winner }">
          <div v-for="(row, rIdx) in board" :key="rIdx" class="board-row">
            <div
              v-for="(cell, cIdx) in row"
              :key="cIdx"
              class="cell"
              :class="{
                'first-row': rIdx === 0,
                'last-row': rIdx === BOARD_SIZE - 1,
                'first-col': cIdx === 0,
                'last-col': cIdx === BOARD_SIZE - 1
              }"
              @click="handleCellClick(rIdx, cIdx)"
            >
              <div class="line-h"></div>
              <div class="line-v"></div>
              <div v-if="isStarPoint(rIdx, cIdx)" class="star-point"></div>
              <div v-if="cell !== 0" :class="['stone', cell === 1 ? 'black' : 'white']">
                <div v-if="lastMove?.row === rIdx && lastMove?.col === cIdx" class="last-move-marker"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button v-if="winner" class="reset-btn" @click="resetGame">重新开始</button>
      <div class="error-msg" v-if="errorMsg">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<style scoped>
.game-layout {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 20px;
}

/* 房间设置 */
.room-setup {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  text-align: center;
}
.input-group { display: flex; gap: 10px; margin-top: 20px; }
.input-group input { padding: 12px; border: 1px solid #ddd; border-radius: 6px; flex: 1; outline: none; }
.input-group button { padding: 12px 20px; background: #2f3542; color: white; border: none; border-radius: 6px; cursor: pointer; }

.gomoku-container { display: flex; flex-direction: column; align-items: center; }
.room-info { margin-bottom: 10px; color: #747d8c; font-size: 0.9rem; }
.status { margin-bottom: 20px; font-size: 1.2rem; font-weight: bold; height: 30px; }
.winner-text { color: #e67e22; animation: pulse 1s infinite; }
.waiting-text { color: #57606f; }

.board-wrapper {
  padding: 15px;
  background-color: #dcb35c;
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  border-radius: 4px;
}
.board { display: flex; flex-direction: column; border: 1px solid #000; }
.board.not-my-turn { cursor: not-allowed; }
.board-row { display: flex; }
.cell { position: relative; width: 40px; height: 40px; cursor: pointer; }

.line-h { position: absolute; top: 20px; left: 0; right: 0; height: 1px; background-color: #000; }
.line-v { position: absolute; left: 20px; top: 0; bottom: 0; width: 1px; background-color: #000; }
.first-row .line-v { top: 20px; }
.last-row .line-v { bottom: 20px; }
.first-col .line-h { left: 20px; }
.last-col .line-h { right: 20px; }

.star-point { position: absolute; width: 8px; height: 8px; background-color: #000; border-radius: 50%; top: 16px; left: 16px; z-index: 1; }
.stone { position: absolute; width: 34px; height: 34px; border-radius: 50%; top: 3px; left: 3px; z-index: 10; box-shadow: 2px 3px 5px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.stone.black { background: radial-gradient(circle at 30% 30%, #444, #000); }
.stone.white { background: radial-gradient(circle at 30% 30%, #fff, #ccc); border: 1px solid #ddd; }
.last-move-marker { width: 6px; height: 6px; background-color: #ff4757; border-radius: 50%; }

.reset-btn { margin-top: 25px; padding: 12px 30px; background-color: #2f3542; color: white; border: none; border-radius: 8px; cursor: pointer; }
.error-msg { color: #ff4757; margin-top: 15px; }

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
</style>
