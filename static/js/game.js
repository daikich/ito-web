const socket = io();

// 現在自分がいるルーム名を記憶しておく変数
let currentRoom = '';

// ゲームの状態を記憶しておく変数
let selectedCard = null;      // 今、自分の手札で選択しているカードの数字
let currentPlayedCards = [];  // 場に出ているカードのリスト
let isRevealed = false;       // 場に出たカードが「結果を見る（表向き）」状態になっているか
let cardComments = {};        // 各カードに書き込まれたコメントを記憶する箱

// ログイン・ルーム関連の処理
// 4桁のランダムな数字を生成して、ルーム名の入力欄に自動で入れる関数
function generateRandomRoom() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    document.getElementById('room-input').value = randomNum;
}

// 最初の画面で「この合言葉で入室する」を押したときの処理
function joinRoom() {
    const name = document.getElementById('name-input').value;
    const room = document.getElementById('room-input').value;
    
    // 名前かルーム名が空っぽならエラーを出す
    if (!name || !room) return alert('名前とルーム名を入力してください。');
    
    currentRoom = room;
    // サーバーに入室したいことを伝える
    socket.emit('join', { name: name, room: room });

    // ログイン画面を隠して、ゲーム画面を表示する
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('room-display').innerText = `ルーム: ${room}`;
}

// 途中で自分だけがゲームから抜ける（最初の画面に戻る）処理
function leaveRoom() {
    socket.emit('leave_room', { room: currentRoom });
    window.location.reload(); // 画面を再読み込みして初期状態に戻す
}

// 部屋ごと削除して、全員を強制的に最初の画面に戻す処理
function disbandRoom() {
    // 誤タップ防止のため、確認ダイアログを出す
    if (confirm('本当にルームを解散しますか？（全員が強制的に入室画面に戻されます）')) {
        socket.emit('disband_room', { room: currentRoom });
    }
}

// ゲーム進行関連の処理
// 「ゲーム開始」や「次のゲームへ進む」を押したときの処理
function startGame() {
    // 選択されているゲームモード（通常 or ずっと1枚）を取得する
    const modeInput = document.querySelector('input[name="game-mode"]:checked');
    // サーバーにゲーム開始の合図を送る
    socket.emit('start_game', { room: currentRoom, mode: modeInput ? modeInput.value : 'normal' });
}

// ゲームを終了して、全員で最初のモード選択状態（リセット状態）に戻る処理
function endGame() {
    if (confirm('ゲームを終了して選択画面に戻りますか？（全員が戻ります）')) {
        socket.emit('end_game', { room: currentRoom });
    }
}

// 全員出し終わったあとに「結果を見る！」を押して、一斉にカードを表にする処理
function revealCards() {
    socket.emit('reveal_cards', { room: currentRoom });
}

// カード操作・コメント関連の処理
// コメント入力欄の中身が変わったときに、サーバーに最新のコメントを送信する処理
function sendComment(cardNumber, text) {
    cardComments[cardNumber] = text; // まず自分の画面（記憶）に反映させる
    socket.emit('edit_comment', { room: currentRoom, card: cardNumber, text: text });
}

// 自分の手札の「選択」ボタンを押したときの処理
function selectCard(cardNumber) {
    // すでに選択中のカードをもう一度押した場合は、選択をキャンセルする
    if (selectedCard === cardNumber) {
        selectedCard = null;
        document.getElementById('card-' + cardNumber).style.border = '4px solid transparent';
        document.getElementById('btn-' + cardNumber).innerText = '選択';
        renderPlayedCards(); // 場の＋ボタンを消すために再描画
        return;
    }

    selectedCard = cardNumber;
    
    // 一旦すべての手札の枠線を消し、ボタンの文字を「選択」に戻す
    document.querySelectorAll('.my-card').forEach(c => c.style.border = '4px solid transparent');
    document.querySelectorAll('.play-btn').forEach(b => b.innerText = '選択');
    
    // 選んだカードだけ赤い枠線にして、ボタンを「選択中」にする
    const targetCard = document.getElementById('card-' + cardNumber);
    if (targetCard) {
        targetCard.style.border = '4px solid #f44336';
        document.getElementById('btn-' + cardNumber).innerText = '選択中';
    }
    
    // 場のカードの間に挿入用の「＋」ボタンを表示するために再描画する
    renderPlayedCards();
}

// 場の「＋」ボタン（または「このカードを場に出す」）を押して、カードを実際に置く処理
function playSelectedCard(index) {
    if (selectedCard === null) return;
    
    // サーバーに「この数字のカードを、この位置(index)に置いたよ」と伝える
    socket.emit('play_card', { room: currentRoom, card: selectedCard, index: index });
    
    // 出したカードは自分の手札エリアから削除する
    const cardElement = document.getElementById('card-' + selectedCard);
    if (cardElement) cardElement.remove();
    
    selectedCard = null; // 選択状態をリセット
    renderPlayedCards(); // 場の「＋」ボタンを消すために再描画
}

// 画面の描画（HTML生成）関連の処理
// サーバーのデータをもとに、場に出ているカードとコメント欄、＋ボタンを描画する処理
function renderPlayedCards() {
    const playedArea = document.getElementById('played-cards-area');
    playedArea.innerHTML = '';
    
    // まだ誰もカードを出していない場合の表示
    if (currentPlayedCards.length === 0) {
        // もし手札を選んでいたら、最初の1枚目を置くための巨大ボタンを出す
        if (selectedCard !== null) {
            playedArea.innerHTML = `<button class="insert-btn insert-large" onclick="playSelectedCard(0)">このカードを場に出す</button>`;
        } else {
            playedArea.innerHTML = '<span style="color: #666;">カードを選択すると、置ける場所が表示されます</span>';
        }
        return;
    }
    
    // 1枚以上カードが出ている場合、カードと隙間（または＋ボタン）を交互に並べていく
    let html = '<div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap;">';
    
    for (let i = 0; i <= currentPlayedCards.length; i++) {
        // カードを選択中 ＆ まだ裏向き（結果発表前）なら、間に「＋」ボタンを出す
        if (selectedCard !== null && !isRevealed) {
            html += `<button class="insert-btn insert-plus" onclick="playSelectedCard(${i})">＋</button>`;
        } else {
            // そうでなければ、ただの隙間をあける
            html += `<div style="width: 10px;"></div>`;
        }
        
        // カード本体を描画する処理（最後の＋ボタンの右側にはカードがないので除外）
        if (i < currentPlayedCards.length) {
            const item = currentPlayedCards[i];
            const commentText = cardComments[item.card] || ''; // 保存されているコメントを取り出す
            
            // 表向き（結果発表後）か、裏向き（プレイ中）かでデザインを変える
            if (isRevealed) {
                html += `
                    <div class="played-card">
                        <div class="number">${item.card}</div>
                        <div class="name">${item.name}</div>
                        <input type="text" class="comment-input" id="comment-played-${item.card}" value="${commentText}" placeholder="コメント..." onchange="sendComment(${item.card}, this.value)">
                    </div>
                `;
            } else {
                html += `
                    <div class="played-card hidden-card">
                        <div class="number">?</div>
                        <div class="name">${item.name}</div>
                        <input type="text" class="comment-input" id="comment-played-${item.card}" value="${commentText}" placeholder="コメント..." onchange="sendComment(${item.card}, this.value)">
                    </div>
                `;
            }
        }
    }
    html += '</div>';
    playedArea.innerHTML = html; // 組み立てたHTMLを画面に反映
}


// サーバーからの通信（イベント）を受け取る処理
// 誰かが入室・退出して、参加者リストが更新されたとき
socket.on('update_players', function(players) {
    document.getElementById('players-display').innerText = players.join(', ');
});

// 新しいゲームが始まって、手札が配られたとき
socket.on('receive_cards', function(data) {
    const container = document.getElementById('my-cards-container');
    container.innerHTML = ''; 
    
    // 配られたカードを1枚ずつHTMLにして画面に追加する
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

// サーバーで新しいステージ（ラウンド）の準備が完了したとき
socket.on('game_started', function(data) {
    // お題を表示
    document.getElementById('theme-display').innerText = data.theme;
    document.getElementById('theme-area').style.display = 'block';
    
    // 前のゲームのデータ（場のカードやコメント）をすべてリセットする
    currentPlayedCards = [];
    selectedCard = null;
    isRevealed = false;
    cardComments = {}; 
    renderPlayedCards();

    // プレイ中の画面レイアウトに切り替える（設定画面などを隠す）
    document.getElementById('game-controls').style.display = 'none';
    document.getElementById('next-game-area').style.display = 'none';
    document.getElementById('end-game-btn').style.display = 'block';
    
    document.getElementById('reveal-btn').style.display = 'inline-block';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('all-played-msg').innerText = '全員がカードを出しました！';
    document.getElementById('all-played-msg').style.color = '#e91e63';
});

// 誰かが場にカードを出して、場の状況が変化したとき
socket.on('card_played', function(data) {
    currentPlayedCards = data.played_cards; // 最新の場のリストを保存
    renderPlayedCards(); // 画面を再描画
});

// 部屋の全員が手札を出し終わったとき
socket.on('all_played', function() {
    // 「全員がカードを出しました！」のエリアを表示させる
    document.getElementById('next-game-area').style.display = 'block';
});

// 誰かが「結果を見る！」ボタンを押して、オープン命令が来たとき
socket.on('cards_revealed', function() {
    isRevealed = true; // 表向きフラグをONにする
    renderPlayedCards(); // 再描画して数字（答え）を表示させる
    
    // 結果発表用のボタンに切り替える
    document.getElementById('reveal-btn').style.display = 'none';
    document.getElementById('next-btn').style.display = 'inline-block';
    
    // 出されたカードが「小さい順（左から右）」に並んでいるか自動でチェックする
    let isSuccess = true;
    for (let i = 0; i < currentPlayedCards.length - 1; i++) {
        // もし左のカードの方が数字が大きければ、失敗と判定
        if (currentPlayedCards[i].card > currentPlayedCards[i+1].card) {
            isSuccess = false;
            break;
        }
    }
    
    // 判定結果に合わせて、メッセージの文字と色を変える
    const msg = document.getElementById('all-played-msg');
    if (isSuccess) {
        msg.innerText = '🎉 成功 🎉';
        msg.style.color = '#f44336'; 
    } else {
        msg.innerText = '💦 失敗 💦';
        msg.style.color = '#2196f3'; 
    }
});

// 誰かが「ゲーム終了」を押して、最初からやり直す命令が来たとき
socket.on('game_ended', function() {
    // プレイ中の要素をすべて隠して、最初の設定画面を復活させる
    document.getElementById('game-controls').style.display = 'block';
    document.getElementById('end-game-btn').style.display = 'none';
    document.getElementById('theme-area').style.display = 'none';
    document.getElementById('next-game-area').style.display = 'none';
    document.getElementById('my-cards-container').innerHTML = '';
    document.getElementById('played-cards-area').innerHTML = 'まだ誰も出していません';
});

// 誰かが「解散ボタン」を押して、部屋がなくなったとき
socket.on('room_disbanded', function() {
    alert('ルームが解散されました。入室画面に戻ります。');
    window.location.reload(); // 画面をリロードして強制退室
});

// 誰かがコメントを入力・編集したとき
socket.on('comments_updated', function(comments) {
    cardComments = comments; // サーバーから来た最新のコメント集で上書き
    
    // すべてのコメント入力欄を、最新の文字に書き換える
    Object.keys(comments).forEach(cardNum => {
        const text = comments[cardNum];
        
        // ただし、自分が今まさにタイピング中の入力欄だけは上書きしないようにする（邪魔しないため）
        const handInput = document.getElementById('comment-hand-' + cardNum);
        if (handInput && document.activeElement !== handInput) handInput.value = text;
        
        const playedInput = document.getElementById('comment-played-' + cardNum);
        if (playedInput && document.activeElement !== playedInput) playedInput.value = text;
    });
});