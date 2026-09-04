const TelegramBot = require('node-telegram-bot-api');
const { createCanvas } = require('canvas');
const http = require('http');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let botUsername = '';
bot.getMe().then(me => botUsername = me.username);

const userPrefs = {}; 
const userGames = {}; 
const games = {}; 

const P = '♟', N = '♞', B = '♝', K = '♚';

const dict = {
  uk: {
    welcome: "♟ Вітаємо у CHESS & CHECKERS!\nОберіть режим гри:",
    friend: "👥 З другом", local: "📱 Один П", vs_bot: "⚓ З ботом",
    settings: "⚙️ Налаштування", info: "ℹ️ Інфо", archive_on: "📦 Архів: УВІМК", archive_off: "📦 Архів: ВИМК",
    lang: "Мова: 🇺🇦 УКР", back: "🔙 Назад",
    diff_title: "⚓ Оберіть складність Шкіпера:", diff_1: "🟢 Легкий", diff_2: "🟡 Середній", diff_3: "🔴 Важкий",
    rules: "❓ Правила", win: "🏆 Перемога", about: "ℹ️ Про гру", feedback: "✉️ Зв'язок",
    btn_resign: "🏳 Здатись", btn_draw: "🤝 Нічия", btn_new: "🔄 Нова гра",
    btn_undo: "↩️ Повернути хід", btn_flip: "⇅ Перевернути", btn_pgn: "💾 PGN",
    cancel_sel: "🔙 Скасувати",
    info_rules_txt: "П **Пішак:** 1 кліт. вперед по діагоналі. Б'є стрибком на 2 кліт.\nКр **Король:** Ходить як пішак (туди й назад). Б'є обов'язково стрибком на 2 кліт.\nС **Слон:** По діагоналі.\nК **Кінь:** Стрибає 3х1.",
    info_win_txt: "Гра закінчується перемогою, якщо ви:\n1. Знищили ДВОХ королів (♚) супротивника.\n2. Заблокували супротивнику всі можливі ходи (пат).",
    info_about_txt: "CHESS & CHECKERS — це унікальна гібридна гра, що поєднує стратегію шахів та динаміку шашок.",
    info_feedback_txt: "Маєте ідеї чи знайшли баг?\nЗв'яжіться з нами: mailpostbox001@gmail.com",
    turn_white: "⚪ Білі", turn_black: "⚫ Чорні", move_made: "Хід зроблено", next_turn: "Наступний хід"
  },
  en: {
    welcome: "♟ Welcome to CHESS & CHECKERS!\nSelect game mode:",
    friend: "👥 Friend", local: "📱 Local", vs_bot: "⚓ Vs Bot",
    settings: "⚙️ Settings", info: "ℹ️ Info", archive_on: "📦 Archive: ON", archive_off: "📦 Archive: OFF",
    lang: "Lang: 🇬🇧 ENG", back: "🔙 Back",
    diff_title: "⚓ Select Skipper Difficulty:", diff_1: "🟢 Easy", diff_2: "🟡 Medium", diff_3: "🔴 Hard",
    rules: "❓ Rules", win: "🏆 Win", about: "ℹ️ About", feedback: "✉️ Feedback",
    btn_resign: "🏳 Resign", btn_draw: "🤝 Draw", btn_new: "🔄 New Game",
    btn_undo: "↩️ Undo", btn_flip: "⇅ Flip", btn_pgn: "💾 PGN",
    cancel_sel: "🔙 Cancel",
    info_rules_txt: "P **Pawn:** 1 square diagonally. Captures by jumping 2 squares.\nK **King:** Moves like pawn (both ways). Captures by jumping.\nB **Bishop:** Moves diagonally.\nN **Knight (Camel):** Jumps 3x1.",
    info_win_txt: "You win if you:\n1. Capture BOTH of the opponent's Kings (♚).\n2. Block all opponent's possible moves (stalemate).",
    info_about_txt: "CHESS & CHECKERS is a unique hybrid game combining chess strategy with checkers dynamics.",
    info_feedback_txt: "Have ideas or found a bug?\nContact us: mailpostbox001@gmail.com",
    turn_white: "⚪ White", turn_black: "⚫ Black", move_made: "Move made", next_turn: "Next turn"
  }
};

function t(key, chatId) {
  const lang = (userPrefs[chatId] && userPrefs[chatId].lang) ? userPrefs[chatId].lang : 'uk';
  return dict[lang][key];
}

function getUserPref(chatId) {
  if (!userPrefs[chatId]) userPrefs[chatId] = { lang: 'uk', archive: false };
  return userPrefs[chatId];
}

function sqName(r, c) { return String.fromCharCode(97 + c) + (8 - r); }

function getPieceText(pieceType) {
  if (pieceType === P) return '♟';
  if (pieceType === N) return '♞';
  if (pieceType === B) return '♝';
  if (pieceType === K) return '♚';
  return pieceType;
}

function getBtnEmoji(piece) {
  if (!piece) return '';
  return (piece.c === 'green' ? '▫️ ' : '▪️ ') + (piece.t === P ? 'П' : piece.t === N ? 'К' : piece.t === B ? 'С' : 'Кр');
}

function createInitialBoard() {
  let board = Array(8).fill(null).map(() => Array(8).fill(null));
  board[0][1] = { c: 'green', t: N }; board[0][3] = { c: 'green', t: K }; 
  board[0][5] = { c: 'green', t: K }; board[0][7] = { c: 'green', t: B };
  [0, 2, 4, 6].forEach(c => board[1][c] = { c: 'green', t: P }); 
  [1, 3, 5, 7].forEach(c => board[2][c] = { c: 'green', t: P });
  
  [0, 2, 4, 6].forEach(c => board[5][c] = { c: 'blue', t: P }); 
  [1, 3, 5, 7].forEach(c => board[6][c] = { c: 'blue', t: P });
  board[7][0] = { c: 'blue', t: B }; board[7][2] = { c: 'blue', t: K }; 
  board[7][4] = { c: 'blue', t: K }; board[7][6] = { c: 'blue', t: N };
  return board;
}

function generateBoardImage(board, isFlipped = false, lastMove = null) {
  const size = 800;
  const cellSize = size / 8;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Обов'язкова заливка фону, щоб уникнути чорного екрана в Telegram!
  ctx.fillStyle = '#ececd7';
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const drawR = isFlipped ? 7 - r : r;
      const drawC = isFlipped ? 7 - c : c;
      const isDark = (drawR + drawC) % 2 !== 0;
      
      let isLastMove = (lastMove && ((drawR === lastMove.sr && drawC === lastMove.sc) || (drawR === lastMove.tr && drawC === lastMove.tc)));
      
      let fillColor = isDark ? '#6b889e' : '#ececd7';
      if (isLastMove) fillColor = isDark ? '#baca44' : '#f6f669';
      
      ctx.fillStyle = fillColor;
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);

      // Координати
      ctx.fillStyle = isLastMove ? '#333' : (isDark ? '#ececd7' : '#6b889e');
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      if (c === 7) ctx.fillText(8 - drawR, c * cellSize + cellSize - 8, r * cellSize + 24);
      
      ctx.textAlign = 'left';
      if (r === 7) ctx.fillText(String.fromCharCode(97 + drawC), c * cellSize + 8, r * cellSize + cellSize - 8);

      const piece = board[drawR][drawC];
      if (piece) {
        const pColor = piece.c === 'green' ? '#ffffff' : '#000000';
        const strokeColor = piece.c === 'green' ? '#000000' : '#ffffff';
        
        ctx.fillStyle = pColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.font = 'bold 65px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const cx = c * cellSize + cellSize / 2;
        const cy = r * cellSize + cellSize / 2 + 5;
        
        ctx.fillText(getPieceText(piece.t), cx, cy);
        ctx.strokeText(getPieceText(piece.t), cx, cy);
      }
    }
  }
  return canvas.toBuffer('image/png');
}

function isJumpMove(sr, sc, tr, tc, piece, board) {
  if (piece.t !== P && piece.t !== K) return false;
  const dr = tr - sr, dc = tc - sc;
  if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
    if (piece.t === P && dr !== (piece.c === 'blue' ? -2 : 2)) return false;
    const midPiece = board[sr + dr/2][sc + dc/2];
    return (midPiece && midPiece.c !== piece.c && !board[tr][tc]);
  }
  return false;
}

function isValidMove(sr, sc, tr, tc, piece, board, mustJumpPiece) {
  const target = board[tr][tc];
  if (target && target.c === piece.c) return false;
  const dr = tr - sr, dc = tc - sc, adr = Math.abs(dr), adc = Math.abs(dc);

  if (mustJumpPiece) {
    if (sr !== mustJumpPiece.r || sc !== mustJumpPiece.c) return false;
    return isJumpMove(sr, sc, tr, tc, piece, board);
  }

  if (piece.t === P) {
    if (dr === (piece.c === 'blue' ? -1 : 1) && adc === 1 && !target) return true;
    if (isJumpMove(sr, sc, tr, tc, piece, board)) return true;
  }
  if (piece.t === K && isJumpMove(sr, sc, tr, tc, piece, board)) return true;
  if (piece.t === N && ((adr === 3 && adc === 1) || (adr === 1 && adc === 3))) return true;
  if (piece.t === B || piece.t === K) {
    if (adr === adc && adr > 0) {
      if (piece.t === K) {
        if (adr > 1 || target) return false; 
      } else if (piece.t === B) { 
        for (let i = 1; i < adr; i++) if (board[sr + i * (dr/adr)][sc + i * (dc/adc)]) return false; 
      }
      return true;
    }
  }
  return false;
}

function hasAvailableJumps(r, c, piece, board) {
  if (piece.t !== P && piece.t !== K) return false;
  const dirs = piece.t === P ? [[piece.c==='blue'?-2:2, -2], [piece.c==='blue'?-2:2, 2]] : [[-2,-2],[-2,2],[2,-2],[2,2]];
  for (let [dr, dc] of dirs) {
    let tr = r + dr, tc = c + dc;
    if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8 && isJumpMove(r, c, tr, tc, piece, board)) return true;
  }
  return false;
}

function getAllValidMoves(board, turn, mustJumpPiece) {
  let moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.c === turn) {
        for (let tr = 0; tr < 8; tr++) {
          for (let tc = 0; tc < 8; tc++) {
            if (isValidMove(r, c, tr, tc, piece, board, mustJumpPiece)) {
              moves.push({ sr: r, sc: c, tr, tc, piece });
            }
          }
        }
      }
    }
  }
  if (!mustJumpPiece) {
    const mandatoryJumps = moves.filter(m => (m.piece.t === P || m.piece.t === K) && isJumpMove(m.sr, m.sc, m.tr, m.tc, m.piece, board));
    if (mandatoryJumps.length > 0) return mandatoryJumps; 
  }
  return moves;
}

function checkWin(game) {
  let blueKings = 0;
  let greenKings = 0;
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (p && p.t === K) {
        if (p.c === 'blue') blueKings++;
        if (p.c === 'green') greenKings++;
      }
    }
  }
  
  if (blueKings === 0) return "🏆 Перемога! Знищено всіх королів чорних.";
  if (greenKings === 0) return "🏆 Перемога! Знищено всіх королів білих.";

  const moves = getAllValidMoves(game.board, game.turn, game.mustJumpPiece);
  if (moves.length === 0) {
    return game.turn === 'blue' 
      ? "🏆 Перемога білих! У чорних немає ходів (пат)." 
      : "🏆 Перемога чорних! У білих немає ходів (пат).";
  }
  
  return null;
}

function getKeyboard(game, playerId) {
  const pref = getUserPref(playerId);

  if (game.status === 'menu') {
    return {
      inline_keyboard: [
        [
          { text: t('friend', playerId), callback_data: 'mode_friend' },
          { text: t('local', playerId), callback_data: 'mode_local' },
          { text: t('vs_bot', playerId), callback_data: 'menu_bot' }
        ],
        [
          { text: t('settings', playerId), callback_data: 'menu_settings' },
          { text: t('info', playerId), callback_data: 'menu_info' },
          { text: pref.archive ? t('archive_on', playerId) : t('archive_off', playerId), callback_data: 'toggle_archive' }
        ]
      ]
    };
  }

  if (game.status === 'bot') {
    return {
      inline_keyboard: [
        [
          { text: t('diff_1', playerId), callback_data: 'start_bot_1' },
          { text: t('diff_2', playerId), callback_data: 'start_bot_2' },
          { text: t('diff_3', playerId), callback_data: 'start_bot_3' }
        ],
        [{ text: t('back', playerId), callback_data: 'menu_back' }]
      ]
    };
  }

  if (game.status === 'settings') {
    return {
      inline_keyboard: [
        [{ text: t('lang', playerId), callback_data: 'toggle_lang' }],
        [{ text: t('back', playerId), callback_data: 'menu_back' }]
      ]
    };
  }

  if (game.status === 'info') {
    return {
      inline_keyboard: [
        [{ text: t('rules', playerId), callback_data: 'info_rules' }, { text: t('win', playerId), callback_data: 'info_win' }],
        [{ text: t('about', playerId), callback_data: 'info_about' }, { text: t('feedback', playerId), callback_data: 'info_feedback' }],
        [{ text: t('back', playerId), callback_data: 'menu_back' }]
      ]
    };
  }

  if (game.isPromoting) return { inline_keyboard: [] };

  const moves = getAllValidMoves(game.board, game.turn, game.mustJumpPiece);
  const pieces = new Set();
  const kb = [];
  
  const isMyTurn = (!game.p2) ? 
      (game.botLevel > 0 ? game.turn === 'blue' : true) : 
      ((game.turn === 'blue' && playerId === game.p1) || (game.turn === 'green' && playerId === game.p2));
  
  if (isMyTurn && !game.selectedSq) {
    const buttons = [];
    moves.forEach(m => {
      const key = `${m.sr}_${m.sc}`;
      if (!pieces.has(key)) {
        pieces.add(key);
        buttons.push({ text: `${getBtnEmoji(m.piece)} ${sqName(m.sr, m.sc)}`, callback_data: `sel_${m.sr}_${m.sc}` });
      }
    });
    for (let i = 0; i < buttons.length; i += 3) kb.push(buttons.slice(i, i + 3));
  }
  
  if (game.selectedSq && isMyTurn) {
    const targets = game.validTargetMoves || [];
    const tBtns = targets.map(m => ({ text: `➡️ ${sqName(m.tr, m.tc)}`, callback_data: `mov_${m.sr}_${m.sc}_${m.tr}_${m.tc}` }));
    for (let i = 0; i < tBtns.length; i += 3) kb.push(tBtns.slice(i, i + 3));
    kb.push([{ text: t('cancel_sel', playerId), callback_data: "cancel_sel" }]);
  }

  kb.push([
    { text: t('btn_resign', playerId), callback_data: "action_resign" }, 
    { text: t('btn_draw', playerId), callback_data: "action_draw" },
    { text: t('btn_new', playerId), callback_data: "action_new" }
  ]);
  kb.push([
    { text: t('btn_undo', playerId), callback_data: "action_undo" },
    { text: t('btn_flip', playerId), callback_data: "action_flip" },
    { text: t('btn_pgn', playerId), callback_data: "action_pgn" }
  ]);
  
  kb.push([
    { text: t('settings', playerId), callback_data: 'menu_settings' },
    { text: t('info', playerId), callback_data: 'menu_info' },
    { text: pref.archive ? t('archive_on', playerId) : t('archive_off', playerId), callback_data: 'toggle_archive' }
  ]);
  
  return { inline_keyboard: kb };
}

async function generateAndSendAutoPGN(hostId, reasonText) {
  const game = games[hostId];
  if (!game) return;
  
  let pgn = `[Event "CHESS & CHECKERS Telegram Game"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n[Result "${reasonText}"]\n\n`;
  let moves = "";
  for (let i = 0; i < game.history.length; i += 2) {
    moves += `${Math.floor(i / 2) + 1}. ${game.history[i]} `;
    if (game.history[i + 1]) moves += `${game.history[i + 1]} `;
  }
  if (moves === "") moves = "*";
  
  const buffer = Buffer.from(pgn + moves, 'utf8');
  
  for (const pid of [game.p1, game.p2]) {
    if (pid) {
      if (game.lastMsgId[pid] && !getUserPref(pid).archive) bot.deleteMessage(pid, game.lastMsgId[pid]).catch(()=>{});
      await bot.sendDocument(pid, buffer, { caption: reasonText }, { filename: 'game_history.pgn', contentType: 'text/plain' }).catch(()=>{});
    }
  }
  
  initGame(hostId, 'menu');
  await broadcastGame(hostId, t('welcome', hostId));
}

async function broadcastGame(hostId, text) {
  const game = games[hostId];
  if (!game) return;

  for (const pid of [game.p1, game.p2]) {
    if (!pid) continue;
    const isP2 = (pid === game.p2);
    const isFlipped = game.p2 ? isP2 : game.isFlipped; 

    const img = generateBoardImage(game.board, isFlipped, game.lastMove);
    const oldMsgId = game.lastMsgId[pid];
    
    try {
      // Повертаємо image/png для відправки
      const msg = await bot.sendPhoto(pid, img, { caption: text, reply_markup: getKeyboard(game, pid) }, { filename: 'board.png', contentType: 'image/png' });
      game.lastMsgId[pid] = msg.message_id;
    } catch (e) { console.error(e); }
    
    if (oldMsgId && !getUserPref(pid).archive) {
      bot.deleteMessage(pid, oldMsgId).catch(()=>{});
    }
  }
}

function saveState(game) {
  game.historyStack.push({
    board: JSON.parse(JSON.stringify(game.board)),
    turn: game.turn,
    mustJumpPiece: game.mustJumpPiece ? {...game.mustJumpPiece} : null,
    history: [...game.history],
    lastMove: game.lastMove ? {...game.lastMove} : null
  });
}

function makeBotMove(hostId) {
  const game = games[hostId];
  if (!game || game.turn !== 'green' || game.isPromoting) return;

  const moves = getAllValidMoves(game.board, 'green', game.mustJumpPiece);
  if (moves.length === 0) return; 

  let bestScore = -Infinity;
  let bestMoves = [];
  
  for (let m of moves) {
    let score = Math.random() * 5; 
    const targetPiece = game.board[m.tr][m.tc];
    const wasJump = isJumpMove(m.sr, m.sc, m.tr, m.tc, m.piece, game.board);

    if (game.botLevel >= 2) {
      if (wasJump) {
        const midPiece = game.board[m.sr + (m.tr - m.sr)/2][m.sc + (m.tc - m.sc)/2];
        if (midPiece) score += (midPiece.t === K ? 200 : (midPiece.t === P ? 10 : 30));
      } else if (targetPiece) {
        score += (targetPiece.t === K ? 200 : (targetPiece.t === P ? 10 : 30));
      }
      if (m.piece.t === P) { score += ((7 - m.tr) * 2); if (m.tr === 0) score += 50; }
    }

    if (game.botLevel === 3) {
      const oppMoves = getAllValidMoves(game.board, 'blue', null);
      for (let om of oppMoves) {
        if (om.tr === m.tr && om.tc === m.tc && isJumpMove(om.sr, om.sc, om.tr, om.tc, om.piece, game.board)) {
          score -= (m.piece.t === K ? 200 : 50); 
        }
      }
    }

    if (score > bestScore) { bestScore = score; bestMoves = [m]; }
    else if (score === bestScore) { bestMoves.push(m); }
  }

  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  setTimeout(async () => { await handleMove(hostId, chosen.sr, chosen.sc, chosen.tr, chosen.tc); }, 5000);
}

async function handleMove(hostId, sr, sc, tr, tc) {
  const game = games[hostId];
  if (!game || game.isPromoting) return;
  
  const piece = game.board[sr][sc];
  if (!piece || piece.c !== game.turn) return;
  if (!isValidMove(sr, sc, tr, tc, piece, game.board, game.mustJumpPiece)) return;

  saveState(game); 

  const wasJump = isJumpMove(sr, sc, tr, tc, piece, game.board);
  const moveStr = `${sqName(sr, sc)}${wasJump ? 'x' : '-'}${sqName(tr, tc)}`;

  if (game.mustJumpPiece && sr === game.mustJumpPiece.r && sc === game.mustJumpPiece.c) {
    game.history[game.history.length - 1] += `x${sqName(tr, tc)}`; 
  } else {
    game.history.push(moveStr); 
  }

  game.board[tr][tc] = piece;
  game.board[sr][sc] = null;
  
  if (wasJump) {
    game.board[sr + (tr - sr)/2][sc + (tc - sc)/2] = null;
  }
  
  game.lastMove = { sr, sc, tr, tc };
  game.selectedSq = null;
  game.validTargetMoves = [];

  if (wasJump && hasAvailableJumps(tr, tc, piece, game.board)) {
    game.mustJumpPiece = { r: tr, c: tc };
    await broadcastGame(hostId, `🔥 Стрибок: ${moveStr}\n⚠️ Ви мусите стрибати далі!`);
    if (game.botLevel > 0 && game.turn === 'green') makeBotMove(hostId);
    return;
  }

  if (piece.t === P && ((piece.c === 'blue' && tr === 0) || (piece.c === 'green' && tr === 7))) {
    if (game.botLevel > 0 && piece.c === 'green') {
      piece.t = K;
      game.history[game.history.length - 1] += '=' + getPieceText(K);
    } else {
      game.isPromoting = true;
      game.promoTarget = { r: tr, c: tc };
      
      const promoKb = {
        inline_keyboard: [[
            { text: `${getBtnEmoji({c: piece.c, t: K})}`, callback_data: `promo_${K}` },
            { text: `${getBtnEmoji({c: piece.c, t: B})}`, callback_data: `promo_${B}` },
            { text: `${getBtnEmoji({c: piece.c, t: N})}`, callback_data: `promo_${N}` }
        ]]
      };

      const pid = game.turn === 'blue' ? game.p1 : (game.p2 || game.p1);
      bot.sendMessage(pid, `✨ Оберіть фігуру для перетворення:`, {reply_markup: promoKb});
      return;
    }
  }

  game.mustJumpPiece = null;
  game.turn = game.turn === 'green' ? 'blue' : 'green';
  game.isFlipped = (game.turn === 'green');

  let winMsg = checkWin(game);
  if (winMsg) {
    await broadcastGame(hostId, winMsg);
    await generateAndSendAutoPGN(hostId, winMsg);
    return;
  }

  const turnStr = game.turn === 'blue' ? t('turn_black', game.p1) : t('turn_white', game.p1);
  await broadcastGame(hostId, `${t('move_made', game.p1)}: ${moveStr}\n${t('next_turn', game.p1)}: ${turnStr}`);

  if (game.botLevel > 0 && game.turn === 'green') makeBotMove(hostId);
}

function initGame(hostId, status = 'menu') {
  games[hostId] = { 
    p1: hostId, p2: null, board: createInitialBoard(), turn: 'blue', mustJumpPiece: null, 
    history: [], isPromoting: false, isFlipped: false, botLevel: 0,  
    lastMsgId: {}, lastMove: null, selectedSq: null, validTargetMoves: [], historyStack: [],
    status: status, prevStatus: 'menu'
  };
}

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const param = match[1];

  if (param && param.startsWith('join_')) {
    const hostId = parseInt(param.split('_')[1]);
    if (games[hostId] && !games[hostId].p2 && hostId !== chatId) {
      games[hostId].p2 = chatId;
      games[hostId].botLevel = 0;
      games[hostId].status = 'playing';
      userGames[chatId] = hostId;
      await broadcastGame(hostId, "🎉 Другий гравець приєднався! Гра почалася.");
      return;
    }
  }

  userGames[chatId] = chatId;
  initGame(chatId, 'menu');
  await broadcastGame(chatId, t('welcome', chatId));
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data;
  const hostId = userGames[chatId];
  const game = games[hostId];

  if (!game) { return bot.answerCallbackQuery(query.id, { text: "Почніть нову гру /start" }); }

  if (data === 'menu_back') {
    game.status = game.prevStatus || 'menu';
    try { await bot.editMessageReplyMarkup(getKeyboard(game, chatId), { chat_id: chatId, message_id: msgId }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  }
  if (data === 'menu_settings' || data === 'menu_info' || data === 'menu_bot') {
    game.prevStatus = (game.status === 'menu' || game.status === 'playing') ? game.status : 'menu';
    game.status = data.split('_')[1]; 
    try { await bot.editMessageReplyMarkup(getKeyboard(game, chatId), { chat_id: chatId, message_id: msgId }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'toggle_lang') {
    const pref = getUserPref(chatId);
    pref.lang = pref.lang === 'uk' ? 'en' : 'uk';
    try { await bot.editMessageReplyMarkup(getKeyboard(game, chatId), { chat_id: chatId, message_id: msgId }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  }
  if (data === 'toggle_archive') {
    const pref = getUserPref(chatId);
    pref.archive = !pref.archive;
    try { await bot.editMessageReplyMarkup(getKeyboard(game, chatId), { chat_id: chatId, message_id: msgId }); } catch(e){}
    return bot.answerCallbackQuery(query.id, { text: pref.archive ? "Архів увімкнено" : "Архів вимкнено" });
  }
  
  if (data === 'info_rules') return bot.answerCallbackQuery(query.id, {text: t('info_rules_txt', chatId), show_alert: true});
  if (data === 'info_win') return bot.answerCallbackQuery(query.id, {text: t('info_win_txt', chatId), show_alert: true});
  if (data === 'info_about') return bot.answerCallbackQuery(query.id, {text: t('info_about_txt', chatId), show_alert: true});
  if (data === 'info_feedback') return bot.answerCallbackQuery(query.id, {text: t('info_feedback_txt', chatId), show_alert: true});

  if (data === 'mode_local') {
    game.status = 'playing'; game.botLevel = 0;
    await broadcastGame(chatId, `${t('turn_black', chatId)}.`);
    return bot.answerCallbackQuery(query.id);
  }
  if (data === 'mode_friend') {
    const link = `https://t.me/${botUsername}?start=join_${chatId}`;
    bot.sendMessage(chatId, `Надішліть це посилання другу:\n${link}\n\nКоли він натисне "Start", ваші ходи з'являться!`);
    return bot.answerCallbackQuery(query.id);
  }
  if (data.startsWith('start_bot_')) {
    const lvl = parseInt(data.split('_')[2]);
    game.status = 'playing'; game.botLevel = lvl;
    await broadcastGame(chatId, `⚓ Шкіпер (Рівень ${lvl}).\nВаш хід (${t('turn_black', chatId)}).`);
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'action_undo') {
    if (game.historyStack.length > 0) {
      let pops = (game.botLevel > 0 && game.turn === 'blue' && game.historyStack.length > 1) ? 2 : 1;
      for(let i=0; i<pops; i++) {
        const prev = game.historyStack.pop();
        game.board = prev.board; game.turn = prev.turn; game.mustJumpPiece = prev.mustJumpPiece;
        game.history = prev.history; game.lastMove = prev.lastMove;
      }
      game.selectedSq = null; game.validTargetMoves = [];
      await broadcastGame(hostId, "↩️ Хід скасовано!");
    } else { bot.answerCallbackQuery(query.id, {text: "Немає ходів для скасування", show_alert:true}); }
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'action_flip') {
    game.isFlipped = !game.isFlipped;
    await broadcastGame(hostId, "🔄 Дошку перевернуто!"); 
    return bot.answerCallbackQuery(query.id);
  }
  
  if (data === 'action_resign') {
    await generateAndSendAutoPGN(hostId, "🏳 Гравець здався.");
    return bot.answerCallbackQuery(query.id);
  }
  
  if (data === 'action_draw') {
    await generateAndSendAutoPGN(hostId, "🤝 Нічия.");
    return bot.answerCallbackQuery(query.id);
  }
  
  if (data === 'action_new') {
    await generateAndSendAutoPGN(hostId, "🔄 Гра завершена (Нова гра).");
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'action_pgn') {
    let pgn = `[Event "CHESS & CHECKERS Telegram Game"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n\n`;
    let moves = "";
    for (let i = 0; i < game.history.length; i += 2) {
      moves += `${Math.floor(i / 2) + 1}. ${game.history[i]} `;
      if (game.history[i + 1]) moves += `${game.history[i + 1]} `;
    }
    if (moves === "") moves = "*";
    bot.sendDocument(chatId, Buffer.from(pgn + moves, 'utf8'), { caption: "Ваша партія (PGN)" }, { filename: 'cheskers.pgn', contentType: 'text/plain' });
    return bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('promo_')) {
    if (!game || !game.isPromoting) return bot.answerCallbackQuery(query.id);
    const chosen = data.split('_')[1];
    
    game.board[game.promoTarget.r][game.promoTarget.c].t = chosen;
    game.history[game.history.length - 1] += '=' + getPieceText(chosen); 
    
    game.isPromoting = false; 
    game.promoTarget = null;
    game.mustJumpPiece = null; 

    game.turn = game.turn === 'green' ? 'blue' : 'green';
    game.isFlipped = (game.turn === 'green');
    bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});

    let winMsg = checkWin(game);
    if (winMsg) {
      await broadcastGame(hostId, winMsg);
      await generateAndSendAutoPGN(hostId, winMsg);
      return bot.answerCallbackQuery(query.id);
    }

    const turnStr = game.turn === 'blue' ? t('turn_black', game.p1) : t('turn_white', game.p1);
    await broadcastGame(hostId, `Фігуру перетворено!\n${t('next_turn', game.p1)}: ${turnStr}`);
    
    if (game.botLevel > 0 && game.turn === 'green') makeBotMove(hostId);
    return bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('sel_')) {
    const [, r, c] = data.split('_').map(Number);
    game.selectedSq = { r, c };
    game.validTargetMoves = getAllValidMoves(game.board, game.turn, game.mustJumpPiece).filter(m => m.sr === r && m.sc === c);
    
    try { await bot.editMessageReplyMarkup(getKeyboard(game, chatId), { chat_id: chatId, message_id: msgId }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  } 
  
  if (data === 'cancel_sel') {
    game.selectedSq = null;
    game.validTargetMoves = [];
    
    try { await bot.editMessageReplyMarkup(getKeyboard(game, chatId), { chat_id: chatId, message_id: msgId }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('mov_')) {
    const [, sr, sc, tr, tc] = data.split('_').map(Number);
    await handleMove(hostId, sr, sc, tr, tc);
  }
  
  bot.answerCallbackQuery(query.id).catch(()=>{});
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
}).listen(PORT, () => {
  console.log(`Веб-сервер слухає порт ${PORT}`);
});
