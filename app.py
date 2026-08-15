from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room
import random
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_key'
socketio = SocketIO(app)

# ゲームの状態を保存する辞書
# 構造: { 'ルーム名': { 'theme': 'お題', 'played_cards': [], 'players': { 'sid': {'name': '名前', 'card': 数字} } } }
games = {}

# お題のリスト（本格的に作る時は data/themes.txt などから読み込みます）
def load_themes():
    themes = []
    file_path = 'data/themes.txt'
    
    # ファイルが存在するかチェック
    if os.path.exists(file_path):
        # utf-8 エンコーディングで読み込む（文字化け対策）
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                theme = line.strip() # 前後の改行や空白を削除
                if theme:            # 空行でなければリストに追加
                    themes.append(theme)
                    
    # もしファイルが無い、または中身が空だった場合の予備データ
    if not themes:
        themes = [
            "予備のお題：好きな食べ物（1:嫌い 〜 100:大好き）",
            "予備のお題：強そうな動物（1:最弱 〜 100:最強）"
        ]
        
    return themes

# サーバー起動時にお題を読み込んでリストにしておく
THEMES = load_themes()

@app.route('/')
def index():
    return render_template('index.html')

# ルームへの参加
@socketio.on('join')
def handle_join(data):
    room = data['room']
    name = data['name']
    sid = request.sid # 接続してきたブラウザの固有ID

    join_room(room)
    
    # ルームが存在しなければ初期化
    if room not in games:
        games[room] = {
            'theme': '',
            'played_cards': [],
            'players': {},
            'stage': 1
        }
    
    # プレイヤー情報を登録
    games[room]['players'][sid] = {'name': name, 'cards': []}
    
    # 現在の参加者リストを作成してルーム全員に通知
    player_names = [p['name'] for p in games[room]['players'].values()]
    emit('update_players', player_names, to=room)

# ゲーム開始（お題決定とカード配布）
@socketio.on('start_game')
def handle_start_game(data):
    room = data['room']
    if room not in games:
        return

    game = games[room]
    players = game['players']
    stage = game['stage']
    
    # フロントエンドから送られてきたモードを受け取り、ゲーム情報に保存する
    if 'mode' in data:
        game['mode'] = data['mode']
        
    mode = game.get('mode', 'normal') # モードを取得（デフォルトはnormal）
    stage = game['stage']

    # 1〜100のカードデッキを作成し、シャッフル
    deck = list(range(1, 101))
    random.shuffle(deck)

    # お題をランダムに決定し、場に出たカードをリセット
    game['theme'] = random.choice(THEMES)
    game['played_cards'] = []

    # 変更：モードによって配る枚数を決定する
    # normalならステージ数と同じ枚数、singleなら常に1枚
    card_count = stage if mode == 'normal' else 1

    for sid, player_info in players.items():
        # 決定した枚数（card_count）だけ配る
        player_info['cards'] = sorted([deck.pop() for _ in range(card_count)])
        emit('receive_cards', {'cards': player_info['cards']}, to=sid)
        
    # ルーム全員にゲームが開始されたことと、お題を通知
    emit('game_started', {'theme': game['theme'], 'stage': stage, 'mode': mode}, to=room)

# カードを場に出す処理
@socketio.on('play_card')
def handle_play_card(data):
    room = data['room']
    sid = request.sid
    played_card = int(data['card'])
    
    if room not in games or sid not in games[room]['players']:
        return

    game = games[room]
    player = game['players'][sid]

    # 持っていないカードが出されたら無視する
    if played_card not in player['cards']:
        return
     
    # プレイヤーの手札から削除
    player['cards'].remove(played_card)
    
    # フロントから受け取った位置(index)に挿入する
    insert_index = data.get('index', len(game['played_cards']))
    game['played_cards'].insert(insert_index, {'name': player['name'], 'card': played_card})

    # ルーム全員に「誰が」「何の数字を」出したかと、今の場の状態を通知
    emit('card_played', {
        'name': player['name'], 
        'card': played_card, 
        'played_cards': game['played_cards']
    }, to=room)
    
    # ルーム内の全員がカードを出し終わったかチェックする
    all_played = True
    for p in game['players'].values():
        if len(p['cards']) > 0:  # 手札のリストにカードが残っているかで判定
            all_played = False
            break
            
    if all_played:
        # クリアしたら次のステージへ
        game['stage'] += 1
        # 全員出し終わっていたら、ルーム全員に通知
        emit('all_played', {}, to=room)

@socketio.on('end_game')
def handle_end_game(data):
    room = data['room']
    if room in games:
        # ルームの進行状況（ステージや出されたカード）をリセットする
        games[room]['stage'] = 1
        games[room]['played_cards'] = []
        games[room]['theme'] = ''
        for p in games[room]['players'].values():
            p['cards'] = []
            
        # ルーム全員に「ゲームが終了した（選択画面に戻る）」ことを通知
        emit('game_ended', {}, to=room)

@socketio.on('reveal_cards')
def handle_reveal_cards(data):
    room = data['room']
    # 誰かが「結果を見る」を押したら、ルームの全員に「表にして！」という合図を送る
    emit('cards_revealed', {}, to=room)

# プレイヤーの退出処理（1人だけ抜ける）
@socketio.on('leave_room')
def handle_leave_room(data):
    room = data['room']
    sid = request.sid
    
    if room in games and sid in games[room]['players']:
        # ルームからそのプレイヤーを削除
        del games[room]['players'][sid]
        
        # 誰もいなくなったらルームごと削除
        if len(games[room]['players']) == 0:
            del games[room]
        else:
            # 残っているメンバーに参加者リストが減ったことを通知
            player_names = [p['name'] for p in games[room]['players'].values()]
            emit('update_players', player_names, to=room)

# ルーム解散処理（全員戻す）
@socketio.on('disband_room')
def handle_disband_room(data):
    room = data['room']
    # サーバーからルームのデータを消去
    if room in games:
        del games[room]
    
    # ルーム全員に解散の合図を送る
    emit('room_disbanded', {}, to=room)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)