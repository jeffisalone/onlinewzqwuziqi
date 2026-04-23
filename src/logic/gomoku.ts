
export type Player = 1 | 2; // 1 为黑棋, 2 为白棋
export type Cell = Player | 0;

export const BOARD_SIZE = 15;

export function checkWinner(board: Cell[][], row: number, col: number): Player | null {
  const player = board[row][col];
  if (player === 0) return null;

  const directions = [
    [0, 1],  // 水平
    [1, 0],  // 垂直
    [1, 1],  // 主对角线
    [1, -1]  // 副对角线
  ];

  for (const [dr, dc] of directions) {
    let count = 1;

    // 向一个方向检查
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }

    // 向相反方向检查
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
      count++;
      r -= dr;
      c -= dc;
    }

    if (count >= 5) return player as Player;
  }

  return null;
}
