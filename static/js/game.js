const socket = io();

// 現在自分がいるルーム名と自分の名前を記憶しておく変数
let currentRoom = '';
let myName = ''; 

// ゲームの状態を記憶しておく変数
let selectedCard = null;      
let currentPlayedCards = [];  
let isRevealed = false;       
let cardComments = {};        

// ==========================================
// ログイン・ルーム関連の処理
// ==========================================

function generateRandomRoom() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    document.getElementById('room-input').value = randomNum;
}

function joinRoom() {
    const name = document.getElementById('name-input').value;
    const room = document.getElementById('room-input').value;
    
    if (!name || !room) return alert('名前とルーム名を入力してください。');
    
    currentRoom = room;
    myName = name; // 入力された自分の名前を記憶しておく
    
    socket.emit('join', { name: name, room: room });

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('room-display').innerText = `ルーム: ${room}`;
}

function leaveRoom() {
    socket.emit('leave_room', { room: currentRoom });
    window.location.reload(); 
}

function disbandRoom() {
    if (confirm('本当にルームを解散しますか？（全員が強制的に入室画面に戻されます）')) {
        socket.emit('disband_room', { room: currentRoom });
    }
}

// 特定のプレイヤーをキックする処理
function kickPlayer(targetName) {
    if (confirm(`${targetName} さんをルームからキックしますか？`)) {
        socket.emit('kick_player', { room: currentRoom, target_name: targetName });
    }
}

// ==========================================
// ゲーム進行関連の処理
// ==========================================

function startGame() {
    const modeInput = document.querySelector('input[name="game-mode"]:checked');
    socket.emit('start_game', { room: currentRoom, mode: modeInput ? modeInput.value : 'normal' });
}

function endGame() {
    if (confirm('ゲームを終了して選択画面に戻りますか？（全員が戻ります）')) {
        socket.emit('end_game', { room: currentRoom });
    }
}

function revealCards() {
    socket.emit('reveal_cards', { room: currentRoom });
}

// ==========================================
// カード操作・コメント関連の処理
// ==========================================

function sendComment(cardNumber, text) {
    cardComments[cardNumber] = text; 
    socket.emit('edit_comment', { room: currentRoom, card: cardNumber, text: text });
}

function selectCard(cardNumber) {
    if (selectedCard === cardNumber) {
        selectedCard = null;
        document.getElementById('card-' + cardNumber).style.border = '4px solid transparent';
        document.getElementById('btn-' + cardNumber).innerText = '選択';
        renderPlayedCards(); 
        return;
    }

    selectedCard = cardNumber;
    
    document.querySelectorAll('.my-card').forEach(c => c.style.border = '4px solid transparent');
    document.querySelectorAll('.play-btn').forEach(b => b.innerText = '選択');
    
    const targetCard = document.getElementById('card-' + cardNumber);
    if (targetCard) {
        targetCard.style.border = '4px solid #f44336';
        document.getElementById('btn-' + cardNumber).innerText = '選択中';
    }
    
    renderPlayedCards();
}

function playSelectedCard(index) {
    if (selectedCard === null) return;
    
    socket.emit('play_card', { room: currentRoom, card: selectedCard, index: index });
    
    const cardElement = document.getElementById('card-' + selectedCard);
    if (cardElement) cardElement.remove();
    
    selectedCard = null; 
    renderPlayedCards(); 
}

// ==========================================
// 画面の描画（HTML生成）関連の処理
// ==========================================

function renderPlayedCards() {
    const playedArea = document.getElementById('played-cards-area');
    playedArea.innerHTML = '';
    
    if (currentPlayedCards.length === 0) {
        if (selectedCard !== null) {
            playedArea.innerHTML = `<button class="insert-btn insert-large" onclick="playSelectedCard(0)">このカードを場に出す</button>`;
        } else {
            playedArea.innerHTML = '<span style="color: #666;">カードを選択すると、置ける場所が表示されます</span>';
        }
        return;
    }
    
    let html = '<div class="timeline-container">';
    
    for (let i = 0; i <= currentPlayedCards.length; i++) {
        
        // ＋ボタンの描画
        if (selectedCard !== null && !isRevealed) {
            html += `<button class="insert-btn insert-plus" onclick="playSelectedCard(${i})">＋</button>`;
        }
        
        if (i < currentPlayedCards.length) {
            const item = currentPlayedCards[i];
            const commentText = cardComments[item.card] || ''; 
            
            // 自分が出したカードかどうかの判定
            const isMine = (item.name === myName);
            const readonlyAttr = isMine ? '' : 'readonly'; 
            const placeholderText = isMine ? 'コメント...' : ''; 
            
            if (isRevealed) {
                html += `
                    <div class="played-card">
                        <div class="number">${item.card}</div>
                        <div class="name">${item.name}</div>
                        <input type="text" class="comment-input" id="comment-played-${item.card}" value="${commentText}" placeholder="${placeholderText}" ${readonlyAttr} onchange="sendComment(${item.card}, this.value)">
                    </div>
                `;
            } else {
                html += `
                    <div class="played-card hidden-card">
                        <div class="number">?</div>
                        <div class="name">${item.name}</div>
                        <input type="text" class="comment-input" id="comment-played-${item.card}" value="${commentText}" placeholder="${placeholderText}" ${readonlyAttr} onchange="sendComment(${item.card}, this.value)">
                    </div>
                `;
            }
        }
    }
    html += '</div>';
    playedArea.innerHTML = html; 
}

// ==========================================
// サーバーからの通信（イベント）を受け取る処理
// ==========================================

socket.on('update_players', function(players) {
    const display = document.getElementById('players-display');
    display.innerHTML = ''; // 一旦クリア
    
    players.forEach((pName, index) => {
        const span = document.createElement('span');
        span.innerText = pName;
        span.style.display = 'inline-flex';
        span.style.alignItems = 'center';
        
        // 自分「以外」のプレイヤーにはキックボタン(✕)をつける
        if (pName !== myName) {
            const kickBtn = document.createElement('button');
            kickBtn.innerText = '✕';
            kickBtn.className = 'kick-btn';
            kickBtn.onclick = () => kickPlayer(pName);
            span.appendChild(kickBtn);
        }
        
        display.appendChild(span);
        
        // 最後のプレイヤーじゃなければカンマで区切る
        if (index < players.length - 1) {
            const comma = document.createElement('span');
            comma.innerText = ', ';
            comma.style.marginRight = '5px';
            display.appendChild(comma);
        }
    });
});

socket.on('receive_cards', function(data) {
    const container = document.getElementById('my-cards-container');
    container.innerHTML = ''; 
    
    data.cards.forEach(cardNum => {
        const commentText = cardComments[cardNum] || '';
        const cardHtml = `
            <div class="my-card" id="card-${cardNum}">
                <div class="number">${cardNum}</div>
                <input type="text" class="comment-input" id="comment-hand-${cardNum}" value="${commentText}" placeholder="コメント..." onchange="sendComment(${cardNum}, this.value)">
                <button class="play-btn" id="btn-${cardNum}" onclick="selectCard(${cardNum})">選択</button>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
});

socket.on('game_started', function(data) {
    document.getElementById('theme-display').innerText = data.theme;
    document.getElementById('theme-area').style.display = 'block';
    
    currentPlayedCards = [];
    selectedCard = null;
    isRevealed = false;
    cardComments = {}; 
    renderPlayedCards();

    document.getElementById('game-controls').style.display = 'none';
    document.getElementById('next-game-area').style.display = 'none';
    document.getElementById('end-game-btn').style.display = 'block';
    
    document.getElementById('reveal-btn').style.display = 'inline-block';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('all-played-msg').innerText = '全員がカードを出しました！';
    document.getElementById('all-played-msg').style.color = '#e91e63';
});

socket.on('card_played', function(data) {
    currentPlayedCards = data.played_cards; 
    renderPlayedCards(); 
});

socket.on('all_played', function() {
    document.getElementById('next-game-area').style.display = 'block';
});

socket.on('cards_revealed', function() {
    isRevealed = true; 
    renderPlayedCards(); 
    
    document.getElementById('reveal-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'inline-block';
    
    let isSuccess = true;
    for (let i = 0; i < currentPlayedCards.length - 1; i++) {
        if (currentPlayedCards[i].card > currentPlayedCards[i+1].card) {
            isSuccess = false;
            break;
        }
    }
    
    const msg = document.getElementById('all-played-msg');
    if (isSuccess) {
        msg.innerText = '🎉 成功 🎉';
        msg.style.color = '#f44336'; 
    } else {
        msg.innerText = '💦 失敗 💦';
        msg.style.color = '#2196f3'; 
    }
});

socket.on('game_ended', function() {
    document.getElementById('game-controls').style.display = 'block';
    document.getElementById('end-game-btn').style.display = 'none';
    document.getElementById('theme-area').style.display = 'none';
    document.getElementById('next-game-area').style.display = 'none';
    document.getElementById('my-cards-container').innerHTML = '';
    document.getElementById('played-cards-area').innerHTML = 'まだ誰も出していません';
});

socket.on('room_disbanded', function() {
    alert('ルームが解散されました。入室画面に戻ります。');
    window.location.reload(); 
});

socket.on('comments_updated', function(comments) {
    cardComments = comments; 
    
    Object.keys(comments).forEach(cardNum => {
        const text = comments[cardNum];
        
        const handInput = document.getElementById('comment-hand-' + cardNum);
        if (handInput && document.activeElement !== handInput) handInput.value = text;
        
        const playedInput = document.getElementById('comment-played-' + cardNum);
        if (playedInput && document.activeElement !== playedInput) playedInput.value = text;
    });
});

socket.on('kicked', function() {
    alert('ルームからキックされました。');
    window.location.reload(); 
});
