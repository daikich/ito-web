const socket = io();
let currentRoom = '';

let selectedCard = null;
let currentPlayedCards = [];
let isRevealed = false;

function generateRandomRoom() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    document.getElementById('room-input').value = randomNum;
}

function joinRoom() {
    const name = document.getElementById('name-input').value;
    const room = document.getElementById('room-input').value;
    if (!name || !room) return alert('名前とルーム名を入力してください。');
    currentRoom = room;
    socket.emit('join', { name: name, room: room });

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('room-display').innerText = `ルーム: ${room}`;
}

function startGame() {
    const modeInput = document.querySelector('input[name="game-mode"]:checked');
    socket.emit('start_game', { room: currentRoom, mode: modeInput ? modeInput.value : 'normal' });
}

function endGame() {
    if (confirm('ゲームを終了して選択画面に戻りますか？（全員が戻ります）')) {
        socket.emit('end_game', { room: currentRoom });
    }
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

function revealCards() {
    socket.emit('reveal_cards', { room: currentRoom });
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
    
    let html = '<div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap;">';
    for (let i = 0; i <= currentPlayedCards.length; i++) {
        
        if (selectedCard !== null && !isRevealed) {
            html += `<button class="insert-btn insert-plus" onclick="playSelectedCard(${i})">＋</button>`;
        } else {
            html += `<div style="width: 10px;"></div>`;
        }
        
        if (i < currentPlayedCards.length) {
            const item = currentPlayedCards[i];
            
            if (isRevealed) {
                html += `
                    <div class="played-card">
                        <div class="number">${item.card}</div>
                        <div class="name">${item.name}</div>
                    </div>
                `;
            } else {
                html += `
                    <div class="played-card hidden-card">
                        <div class="number">?</div>
                        <div class="name">${item.name}</div>
                    </div>
                `;
            }
        }
    }
    html += '</div>';
    playedArea.innerHTML = html;
}

// --- サーバーからの受信 ---
socket.on('update_players', function(players) {
    document.getElementById('players-display').innerText = players.join(', ');
});

socket.on('receive_cards', function(data) {
    const container = document.getElementById('my-cards-container');
    container.innerHTML = ''; 
    data.cards.forEach(cardNum => {
        const cardHtml = `
            <div class="my-card" id="card-${cardNum}">
                <div class="number">${cardNum}</div>
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