const TelegramBot = require('node-telegram-bot-api');
const { createCanvas } = require('canvas');
const http = require('http');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let botUsername = '';
bot.getMe().then(me => botUsername = me.username);

const userGames = {}; 
const games = {}; 

const P = '♟', N = '♞', B = '♝', K = '♚';

function sqName(r, c) { return String.fromCharCode(97 + c) + (8 - r); }

function getBtnEmoji(piece) {
  if (!piece) return '';
  if (piece.c === 'green') { 
    if (piece.t === P) return '▫️ ♙'; 
    if (piece.t === N) return '▫️ К';
    if (piece.t === B) return '▫️ С'; 
    if (piece.t === K) return '▫️ Кр';
  } else { 
    if (piece.t === P) return '▪️ ♟'; 
    if (piece.t === N) return '▪️ К';
    if (piece.t === B) return '▪️ С'; 
    if (piece.t === K) return '▪️ Кр';
  }
  return piece.t;
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

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const drawR = isFlipped ? 7 - r : r;
      const drawC = isFlipped ? 7 - c : c;
      const isDark = (drawR + drawC) % 2 !== 0;
      
      let isLastMove = (lastMove && ((drawR === lastMove.sr && drawC === lastMove.sc) || (drawR === lastMove.tr && drawC === lastMove.tc)));
      
      if (isLastMove) ctx.fillStyle = isDark ? '#baca44' : '#f6f669'; 
      else ctx.fillStyle = isDark ? '#6b889e' : '#ececd7';
      
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);

      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = isLastMove ? '#333' : (isDark ? '#ececd7' : '#6b889e');
      if (c === 7) { ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(8 - drawR, (c + 1) * cellSize - 4, r * cellSize + 4); }
      if (r === 7) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(String.fromCharCode(97 + drawC), c * cellSize + 4, (r + 1) * cellSize - 4); }

      const piece = board[drawR][drawC];
      if (piece) {
        ctx.shadowColor = piece.c === 'green' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 5;
        ctx.font = 'bold 65px Arial';
        ctx.fillStyle = piece.c === 'green' ? '#ffffff' : '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(piece.t, c * cellSize + cellSize / 2, r * cellSize + cellSize / 2);
        ctx.shadowBlur = 0;
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
    const pawnJumps = moves.filter(m => m.piece.t === P && isJumpMove(m.sr, m.sc, m.tr, m.tc, m.piece, board));
    if (pawnJumps.length > 0) return pawnJumps; 
  }
  return moves;
}

function getCapturedText(game) {
  const w = game.captured.green.map(p => getBtnEmoji({c:'green', t:p})).join(' ');
  const b = game.captured.blue.map(p => getBtnEmoji({c:'blue', t:p})).join(' ');
  let txt = '';
  if (w) txt += `\nЗбиті білі: ${w}`;
  if (b) txt += `\nЗбиті чорні: ${b}`;
  return txt;
}

async function broadcastGame(hostId, text) {
  const game = games[hostId];
  if (!game) return;
  const capText = text + getCapturedText(game);

  for (const pid of [game.p1, game.p2]) {
    if (!pid) continue;
    const isP2 = (pid === game.p2);
    const isFlipped = game.p2 ? isP2 : game.isFlipped; 

    const img = generateBoardImage(game.board, isFlipped, game.lastMove);

    if (game.lastMsgId[pid] && !game.archiveMode) {
      bot.deleteMessage(pid, game.lastMsgId[pid]).catch(()=>{});
    }

    const msg = await bot.sendPhoto(pid, img, { caption: capText, reply_markup: getMainKeyboard(game, pid) });
    game.lastMsgId[pid] = msg.message_id;
  }
}

async function broadcastFinalDocument(hostId, text) {
  const game = games[hostId];
  if (!game) return;
  const capText = text + getCapturedText(game);

  for (const pid of [game.p1, game.p2]) {
    if (!pid) continue;
    const isP2 = (pid === game.p2);
    const isFlipped = game.p2 ? isP2 : game.isFlipped; 

    if (game.lastMsgId[pid] && !game.archiveMode) {
      bot.deleteMessage(pid, game.lastMsgId[pid]).catch(()=>{});
    }
    const img = generateBoardImage(game.board, isFlipped, game.lastMove);
    await bot.sendDocument(pid, img, { caption: capText }, { filename: 'cheskers_final.png', contentType: 'image/png' });
  }
}

function saveState(game) {
  game.historyStack.push({
    board: JSON.parse(JSON.stringify(game.board)),
    turn: game.turn,
    mustJumpPiece: game.mustJumpPiece ? {...game.mustJumpPiece} : null,
    captured: JSON.parse(JSON.stringify(game.captured)),
    history: [...game.history],
    lastMove: game.lastMove ? {...game.lastMove} : null
  });
}

async function makeBotMove(hostId) {
  const game = games[hostId];
  if (!game || game.turn !== 'green' || game.isPromoting) return;

  const moves = getAllValidMoves(game.board, 'green', game.mustJumpPiece);
  if (moves.length === 0) {
    await broadcastFinalDocument(hostId, "🏳 Бот (Шкіпер) не має ходів. Ви перемогли!");
    delete games[hostId];
    return;
  }

  let bestScore = -Infinity;
  let bestMoves = [];
  
  for (let m of moves) {
    let score = Math.random() * 5;
    const targetPiece = game.board[m.tr][m.tc];
    const wasJump = isJumpMove(m.sr, m.sc, m.tr, m.tc, m.piece, game.board);

    if (wasJump) {
      const midPiece = game.board[m.sr + (m.tr - m.sr)/2][m.sc + (m.tc - m.sc)/2];
      if (midPiece) score += (midPiece.t === K ? 200 : (midPiece.t === P ? 10 : 30));
    } else if (targetPiece) {
      score += (targetPiece.t === K ? 200 : (targetPiece.t === P ? 10 : 30));
    }
    if (m.piece.t === P) { score += ((7 - m.tr) * 2); if (m.tr === 0) score += 50; }

    if (game.botLevel === 2) {
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
  setTimeout(async () => { await handleMove(hostId, chosen.sr, chosen.sc, chosen.tr, chosen.tc); }, 1200);
}

function getMainKeyboard(game, playerId) {
  if (game.isPromoting) return { inline_keyboard: [] };

  const moves = getAllValidMoves(game.board, game.turn, game.mustJumpPiece);
  const pieces = new Set();
  const buttons = [];
  
  const isMyTurn = (!game.p2) ? 
      (game.botLevel > 0 ? game.turn === 'blue' : true) : 
      ((game.turn === 'blue' && playerId === game.p1) || (game.turn === 'green' && playerId === game.p2));
  
  if (isMyTurn && !game.selectedSq) {
    moves.forEach(m => {
      const key = `${m.sr}_${m.sc}`;
      if (!pieces.has(key)) {
        pieces.add(key);
        buttons.push({ text: `${getBtnEmoji(m.piece)} ${sqName(m.sr, m.sc)}`, callback_data: `sel_${m.sr}_${m.sc}` });
      }
    });
  }
  
  const kb = [];
  for (let i = 0; i < buttons.length; i += 3) kb.push(buttons.slice(i, i + 3));
  
  if (game.selectedSq && isMyTurn) {
    const targets = game.validTargetMoves || [];
    const tBtns = targets.map(m => ({ text: `➡️ ${sqName(m.tr, m.tc)}`, callback_data: `mov_${m.sr}_${m.sc}_${m.tr}_${m.tc}` }));
    for (let i = 0; i < tBtns.length; i += 3) kb.push(tBtns.slice(i, i + 3));
    kb.push([{ text: "🔙 Скасувати вибір", callback_data: "cancel_sel" }]);
  }

  kb.push([
    { text: "↩️ Скасувати хід", callback_data: "action_undo" },
    { text: "🤝 Нічия", callback_data: "action_draw" }
  ]);
  kb.push([
    { text: "🏳 Здатись", callback_data: "action_resign" }, 
    { text: "🔄 Нова гра", callback_data: "action_new" }
  ]);
  kb.push([
    { text: "⚙️ Налаштування та Інфо", callback_data: "menu_settings" }
  ]);
  
  return { inline_keyboard: kb };
}

function getSettingsKeyboard(game) {
  let botBtnText = "⚓ Шкіпер: ВИМК";
  let botCallback = "action_bot";

  if (game.p2) {
    botBtnText = "🚫 Шкіпер (Вимк. у Мультиплеєрі)";
    botCallback = "action_bot_disabled";
  } else {
    botBtnText = game.botLevel === 0 ? "⚓ Шкіпер: ВИМК" : (game.botLevel === 1 ? "🤖 Шкіпер: ЛЕГКИЙ" : "🧠 Шкіпер: СКЛАДНИЙ");
  }
  
  return {
    inline_keyboard: [
      [
        { text: botBtnText, callback_data: botCallback },
        { text: "⇅ Переворот", callback_data: "action_flip" }
      ],
      [
        { text: game.archiveMode ? "📦 Архів: УВІМК" : "📦 Архів: ВИМК", callback_data: "action_archive" },
        { text: "🔗 Запросити друга", callback_data: "action_invite" }
      ],
      [
        { text: "❓ Правила", callback_data: "info_rules" },
        { text: "💾 PGN", callback_data: "action_pgn" }
      ],
      [
        { text: "🔙 Назад до гри", callback_data: "menu_main" }
      ]
    ]
  };
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
    const midPiece = game.board[sr + (tr - sr)/2][sc + (tc - sc)/2];
    if (midPiece) game.captured[midPiece.c].push(midPiece.t);
    game.board[sr + (tr - sr)/2][sc + (tc - sc)/2] = null;
  }
  
  game.lastMove = { sr, sc, tr, tc };
  game.selectedSq = null;
  game.validTargetMoves = [];

  if (wasJump && hasAvailableJumps(tr, tc, piece, game.board)) {
    game.mustJumpPiece = { r: tr, c: tc };
    await broadcastGame(hostId, `🔥 Стрибок: ${moveStr}\n⚠️ Ви мусите стрибати далі фігурою з ${sqName(tr, tc)}!`);
    if (game.botLevel > 0 && game.turn === 'green') makeBotMove(hostId);
    return;
  }

  if (piece.t === P && ((piece.c === 'blue' && tr === 0) || (piece.c === 'green' && tr === 7))) {
    if (game.botLevel > 0 && piece.c === 'green') {
      piece.t = K;
      game.history[game.history.length - 1] += '=' + K;
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
      bot.sendMessage(pid, `✨ Ваш пішак дійшов до краю дошки!\nОберіть фігуру для перетворення:`, {reply_markup: promoKb});
      return;
    }
  }

  game.mustJumpPiece = null;
  game.turn = game.turn === 'green' ? 'blue' : 'green';
  game.isFlipped = (game.turn === 'green');

  await broadcastGame(hostId, `Хід зроблено: ${moveStr}\nНаступний хід: ${game.turn === 'blue' ? '⚫ Чорні' : '⚪ Білі'}`);

  if (game.botLevel > 0 && game.turn === 'green') makeBotMove(hostId);
}

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const param = match[1];

  if (param && param.startsWith('join_')) {
    const hostId = parseInt(param.split('_')[1]);
    if (games[hostId] && !games[hostId].p2 && hostId !== chatId) {
      games[hostId].p2 = chatId;
      games[hostId].botLevel = 0;
      userGames[chatId] = hostId;
      await broadcastGame(hostId, "🎉 Другий гравець приєднався! Гра (Мультиплеєр) почалася.");
      return;
    }
  }

  userGames[chatId] = chatId;
  games[chatId] = { 
    p1: chatId, p2: null, board: createInitialBoard(), turn: 'blue', mustJumpPiece: null, 
    history: [], isPromoting: false, isFlipped: false, botLevel: 0, archiveMode: false, 
    lastMsgId: {}, lastMove: null, selectedSq: null, validTargetMoves: [], 
    captured: { blue: [], green: [] }, historyStack: []
  };
  await broadcastGame(chatId, "Гра CHESS & CHECKERS почалася!\n\nВаш хід (⚫ Чорні).");
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const hostId = userGames[chatId];
  const data = query.data;
  const game = games[hostId];

  if (!game && data.startsWith('action_') === false) {
    return bot.answerCallbackQuery(query.id, { text: "Почніть нову гру /start" });
  }

  if (data === 'menu_settings') {
    try { await bot.editMessageReplyMarkup(getSettingsKeyboard(game), { chat_id: chatId, message_id: query.message.message_id }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'menu_main') {
    try { await bot.editMessageReplyMarkup(getMainKeyboard(game, chatId), { chat_id: chatId, message_id: query.message.message_id }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'action_invite') {
    if (game.p2) return bot.answerCallbackQuery(query.id, {text: "Гравець вже приєднався!"});
    const link = `https://t.me/${botUsername}?start=join_${hostId}`;
    bot.sendMessage(chatId, `Надішліть це посилання другу:\n${link}\n\nКоли він натисне "Start", ви гратимете разом!`);
    return bot.answerCallbackQuery(query.id);
  }

  if (data === 'action_undo') {
    if (game.historyStack.length > 0) {
      let pops = (game.botLevel > 0 && game.turn === 'blue' && game.historyStack.length > 1) ? 2 : 1;
      for(let i=0; i<pops; i++) {
        const prev = game.historyStack.pop();
        game.board = prev.board; game.turn = prev.turn; game.mustJumpPiece = prev.mustJumpPiece;
        game.captured = prev.captured; game.history = prev.history; game.lastMove = prev.lastMove;
      }
      game.selectedSq = null; game.validTargetMoves = [];
      await broadcastGame(hostId, "↩️ Хід скасовано!");
      return bot.answerCallbackQuery(query.id);
    }
    return bot.answerCallbackQuery(query.id, {text: "Немає ходів для скасування", show_alert:true});
  }

  if (data === 'action_flip') {
    game.isFlipped = !game.isFlipped;
    await broadcastGame(hostId, "🔄 Дошку перевернуто вручну!"); 
    return bot.answerCallbackQuery(query.id);
  }
  
  if (data === 'action_archive') {
    game.archiveMode = !game.archiveMode;
    try { await bot.editMessageReplyMarkup(getSettingsKeyboard(game), { chat_id: chatId, message_id: query.message.message_id }); } catch(e){}
    return bot.answerCallbackQuery(query.id, { text: game.archiveMode ? "Архів увімкнено" : "Архів вимкнено" });
  }

  if (data === 'action_bot_disabled') {
    return bot.answerCallbackQuery(query.id, { text: "Шкіпера вимкнено, оскільки ви граєте з другом (Мультиплеєр).", show_alert: true });
  }

  if (data === 'action_bot') {
    game.botLevel = (game.botLevel + 1) % 3;
    const statusMsg = game.botLevel === 0 ? "🛑 Бота ВИМКНЕНО." : (game.botLevel === 1 ? "🤖 Бот грає на Легкому рівні." : "🧠 Бот грає на Складному рівні.");
    await bot.sendMessage(chatId, statusMsg);
    
    if (game.botLevel > 0 && game.turn === 'green' && !game.isPromoting) {
      makeBotMove(hostId);
    } else {
      try { await bot.editMessageReplyMarkup(getSettingsKeyboard(game), { chat_id: chatId, message_id: query.message.message_id }); } catch(e){}
    }
    return bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('promo_')) {
    if (!game || !game.isPromoting) return bot.answerCallbackQuery(query.id);
    const chosen = data.split('_')[1];
    
    game.board[game.promoTarget.r][game.promoTarget.c].t = chosen;
    game.history[game.history.length - 1] += '=' + chosen; 
    
    game.isPromoting = false; game.promoTarget = null;
    game.turn = game.turn === 'green' ? 'blue' : 'green';
    game.isFlipped = (game.turn === 'green');
    bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});

    await broadcastGame(hostId, `Фігуру перетворено! Наступний хід: ${game.turn === 'blue' ? '⚫ Чорні' : '⚪ Білі'}`);
    if (game.botLevel > 0 && game.turn === 'green') makeBotMove(hostId);
    return bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('sel_')) {
    const [, r, c] = data.split('_').map(Number);
    game.selectedSq = { r, c };
    game.validTargetMoves = getAllValidMoves(game.board, game.turn, game.mustJumpPiece).filter(m => m.sr === r && m.sc === c);
    
    try { await bot.editMessageReplyMarkup(getMainKeyboard(game, chatId), { chat_id: chatId, message_id: query.message.message_id }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  } 
  else if (data === 'cancel_sel') {
    game.selectedSq = null;
    game.validTargetMoves = [];
    
    try { await bot.editMessageReplyMarkup(getMainKeyboard(game, chatId), { chat_id: chatId, message_id: query.message.message_id }); } catch(e){}
    return bot.answerCallbackQuery(query.id);
  }
  else if (data.startsWith('mov_')) {
    const [, sr, sc, tr, tc] = data.split('_').map(Number);
    await handleMove(hostId, sr, sc, tr, tc);
  }
  else if (data === 'info_rules') {
    await bot.sendMessage(chatId, "♟ **Пішак:** 1 кліт. вперед по діагоналі. Б'є стрибком на 2 кліт. Серії стрибків обов'язкові.\nКр **Король:** Ходить як пішак (туди й назад). Б'є виключно стрибком на 2 кліт.\nС **Слон:** По діагоналі (як у шахах).\nК **Кінь (Верблюд):** Стрибає 3х1.", {parse_mode: "Markdown"});
  }
  else if (data === 'action_resign') {
    if (game) {
      const winner = game.turn === 'green' ? '⚫ Чорні' : '⚪ Білі';
      await broadcastFinalDocument(hostId, `🏳 Гравець здався. Перемогли ${winner}!`);
      delete games[hostId];
    }
  }
  else if (data === 'action_draw') {
    if (game) {
      await broadcastFinalDocument(hostId, "🤝 Гравці погодилися на нічию!");
      delete games[hostId];
    }
  }
  else if (data === 'action_new') {
    let currentArchiveMode = false, currentBotLevel = 0;
    if (game) {
      currentArchiveMode = game.archiveMode; currentBotLevel = game.botLevel;
      await broadcastFinalDocument(hostId, "🏁 Гру завершено. Починаємо нову...");
    }
    games[chatId] = { 
      p1: chatId, p2: null, board: createInitialBoard(), turn: 'blue', mustJumpPiece: null, 
      history: [], isPromoting: false, isFlipped: false, botLevel: currentBotLevel, archiveMode: currentArchiveMode, 
      lastMsgId: {}, lastMove: null, selectedSq: null, validTargetMoves: [], 
      captured: { blue: [], green: [] }, historyStack: []
    };
    await broadcastGame(chatId, "🔄 Нова гра почалася!\n\nВаш хід (⚫ Чорні).");
  }
  else if (data === 'action_pgn') {
    if (!game) return bot.answerCallbackQuery(query.id, { text: "Немає активної гри" });
    let pgn = `[Event "CHESS & CHECKERS Telegram Game"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n\n`;
    let moves = "";
    for (let i = 0; i < game.history.length; i += 2) {
      moves += `${Math.floor(i / 2) + 1}. ${game.history[i]} `;
      if (game.history[i + 1]) moves += `${game.history[i + 1]} `;
    }
    if (moves === "") moves = "*";
    await bot.sendDocument(chatId, Buffer.from(pgn + moves, 'utf8'), { caption: "Ваша партія (текстовий PGN)" }, { filename: 'cheskers.pgn', contentType: 'text/plain' });
  }
  
  bot.answerCallbackQuery(query.id).catch(()=>{});
});

// Міні-сервер для утримання Render у робочому стані
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
}).listen(PORT, () => {
  console.log(`Веб-сервер слухає порт ${PORT}`);
});

console.log('Бот запущений (Міні-маркери + Сервер)');
