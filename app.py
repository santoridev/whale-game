from flask import Flask, request, jsonify, session, render_template
import json
import secrets
import sqlite3
import requests
import hmac
import hashlib
from urllib.parse import parse_qs, unquote
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

BOT_TOKEN = "8069974789:AAGG34OdZcUEW987VIHSlwpaP4zIF9kTCw0"  # Your bot token

def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            telegram_id TEXT PRIMARY KEY,
            username TEXT,
            referrals INTEGER DEFAULT 0,
            referrer_id TEXT,
            banana_count REAL DEFAULT 0,
            has_completed_welcome INTEGER DEFAULT 0
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_tasks (
            telegram_id TEXT,
            task_id TEXT,
            completed INTEGER DEFAULT 0,
            PRIMARY KEY (telegram_id, task_id),
            FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS king_of_the_hill (
            telegram_id TEXT PRIMARY KEY,
            username TEXT,
            expires_at TIMESTAMP,
            started_at TIMESTAMP,
            FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            task_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            reward INTEGER NOT NULL,
            link TEXT,
            required INTEGER
        )
    ''')
    
    c.execute("SELECT COUNT(*) FROM tasks")
    if c.fetchone()[0] == 0:
        initial_tasks = [
            ('task_join3', 'mBit Casino', 'Make a deposit', 300, 'https://whalegame.space/', None),
            ('task_invite_3', 'Invite 3 Friends', 'Invite 3 friends to play', 300, None, 3),
            ('task_invite_5', 'Invite 5 Friends', 'Invite 5 friends to join', 500, None, 5),
            ('task_invite_10', 'Invite 10 Friends', 'Invite 10 friends to join', 1000, None, 10),
            ('task_join1', 'Join Kolobok', 'Join and play', 300, 'https://t.me/bokgame_bot/', None),
            ('task_join2', 'Join nikita', 'Join and play', 300, 'https://t.me/mlaffonxd/', None)
        ]
        c.executemany('''
            INSERT INTO tasks (task_id, title, description, reward, link, required)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', initial_tasks)
    
    conn.commit()
    conn.close()

def add_or_update_user(telegram_id, username=None, referrer_id=None, has_completed_welcome=None, banana_count=None):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT telegram_id, referrer_id FROM users WHERE telegram_id = ?", (telegram_id,))
    user = c.fetchone()

    if user is None:
        c.execute(
            "INSERT INTO users (telegram_id, username, referrer_id, has_completed_welcome, banana_count) VALUES (?, ?, ?, ?, ?)",
            (telegram_id, username, referrer_id, 0 if has_completed_welcome is None else has_completed_welcome,
             0 if banana_count is None else banana_count)
        )
        if referrer_id:
            c.execute("UPDATE users SET referrals = referrals + 1 WHERE telegram_id = ?", (referrer_id,))
    else:
        updates = []
        params = []
        if username is not None:
            updates.append("username = ?")
            params.append(username)
        if has_completed_welcome is not None:
            updates.append("has_completed_welcome = ?")
            params.append(has_completed_welcome)
        if banana_count is not None:
            updates.append("banana_count = ?")
            params.append(banana_count)
        if referrer_id and user[1] is None:
            updates.append("referrer_id = ?")
            params.append(referrer_id)
            c.execute("UPDATE users SET referrals = referrals + 1 WHERE telegram_id = ?", (referrer_id,))
        if updates:
            params.append(telegram_id)
            query = f"UPDATE users SET {', '.join(updates)} WHERE telegram_id = ?"
            c.execute(query, tuple(params))

    conn.commit()
    conn.close()

def get_user(telegram_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT telegram_id, username, has_completed_welcome, banana_count, referrals FROM users WHERE telegram_id = ?",
              (telegram_id,))
    user = c.fetchone()
    conn.close()
    
    if user:
        return {
            'telegram_id': user[0],
            'username': user[1],
            'has_completed_welcome': bool(user[2]),
            'banana_count': float(user[3]),
            'referrals': user[4] if user[4] is not None else 0
        }
    return None

def get_leaderboard(telegram_id=None, limit=10):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    c.execute("SELECT username, banana_count FROM users WHERE banana_count > 0 ORDER BY banana_count DESC LIMIT ?", 
             (limit,))
    leaders = c.fetchall()
    
    current_user = None
    if telegram_id:
        c.execute("""
            SELECT username, banana_count,
                   (SELECT COUNT(*) + 1 FROM users u2 WHERE u2.banana_count > u1.banana_count) AS rank
            FROM users u1 WHERE telegram_id = ?
        """, (telegram_id,))
        current_user = c.fetchone()
    
    c.execute("SELECT telegram_id, username, expires_at FROM king_of_the_hill WHERE expires_at > ?", 
             (datetime.now(),))
    king = c.fetchone()
    
    conn.close()
    
    leaderboard = [{'username': l[0], 'banana_count': float(l[1])} for l in leaders]
    
    if current_user and current_user[1] > 0:
        current_user_data = {
            'username': current_user[0],
            'banana_count': float(current_user[1]),
            'rank': current_user[2],
            'is_current_user': True
        }
        if not any(l['username'] == current_user[0] for l in leaderboard):
            leaderboard.append(current_user_data)
        else:
            for leader in leaderboard:
                if leader['username'] == current_user[0]:
                    leader.update(current_user_data)
    
    leaderboard.sort(key=lambda x: x['banana_count'], reverse=True)
    for i, leader in enumerate(leaderboard, 1):
        if 'rank' not in leader:
            leader['rank'] = i
    
    king_data = None
    if king:
        king_data = {
            'telegram_id': king[0],
            'username': king[1],
            'expires_at': king[2].isoformat(),
            'banana_count': next((l['banana_count'] for l in leaderboard if l['username'] == king[1]), 0)
        }
    
    return {'leaders': leaderboard, 'king': king_data}

def get_all_tasks():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT task_id, title, description, reward, link, required FROM tasks")
    tasks = c.fetchall()
    conn.close()
    
    return [{
        'id': task[0],
        'title': task[1],
        'description': task[2],
        'reward': task[3],
        'link': task[4] if task[4] else '',
        'required': task[5] if task[5] is not None else None
    } for task in tasks]

def verify_telegram_web_app_data(telegram_init_data):
    init_data = parse_qs(unquote(telegram_init_data))
    hash_value = init_data.get('hash', [None])[0]
    if not hash_value:
        return False, {}

    sorted_items = sorted((k, v[0]) for k, v in init_data.items() if k != 'hash')
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted_items)
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    
    return calculated_hash == hash_value, dict(sorted_items)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/auth', methods=['POST'])
def auth():
    data = request.json
    init_data = data.get("initData", "")
    if not init_data:
        return jsonify({'message': 'Missing initData'}), 400

    is_valid, parsed_data = verify_telegram_web_app_data(init_data)
    if not is_valid:
        return jsonify({'message': 'Authentication failed'}), 403

    user_json = parsed_data.get("user")
    if not user_json:
        return jsonify({'message': 'User data missing'}), 400
    
    user_info = json.loads(user_json)
    telegram_id = str(user_info.get("id"))
    username = user_info.get("username", f"BananaPlayer{int(int(telegram_id) ** 0.5)}")
    start_param = parsed_data.get("start_param", None)
    referrer_id = str(start_param) if start_param is not None else None

    session['telegram_id'] = telegram_id
    add_or_update_user(telegram_id, username, referrer_id)
    return jsonify({'message': 'Authentication successful'})

@app.route('/get_user_state', methods=['GET'])
def get_user_state():
    telegram_id = request.args.get('telegram_id') or session.get('telegram_id')
    if not telegram_id:
        return jsonify({'message': 'User not authenticated'}), 401
    
    user = get_user(telegram_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    return jsonify({
        "banana_count": user['banana_count'],
        "has_completed_welcome": user['has_completed_welcome'],
        "referrals": user['referrals']
    })

@app.route('/update_user_state', methods=['POST'])
def update_user_state():
    telegram_id = session.get('telegram_id')
    if not telegram_id:
        return jsonify({'message': 'User not authenticated'}), 401

    data = request.json
    banana_count = data.get('banana_count')
    has_completed_welcome = data.get('has_completed_welcome')
    
    user = get_user(telegram_id)
    if user:
        add_or_update_user(
            telegram_id,
            banana_count=float(banana_count) if banana_count is not None else None,
            has_completed_welcome=has_completed_welcome
        )
        return jsonify({'message': 'User state updated'})
    return jsonify({'message': 'User not found'}), 404

@app.route('/leaderboard', methods=['GET'])
def leaderboard():
    telegram_id = session.get('telegram_id')
    limit = request.args.get('limit', default=10, type=int)
    return jsonify(get_leaderboard(telegram_id, limit))

@app.route('/tasks', methods=['GET'])
def get_tasks():
    telegram_id = request.args.get('telegram_id') or session.get('telegram_id')
    if not telegram_id:
        return jsonify({"message": "Authentication required"}), 401

    user = get_user(telegram_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT task_id, completed FROM user_tasks WHERE telegram_id = ?", (telegram_id,))
    completed_tasks = dict(c.fetchall())
    conn.close()

    tasks = get_all_tasks()
    for task in tasks:
        task['completed'] = bool(completed_tasks.get(task['id'], 0))
        if task['required'] is not None:
            task['progress'] = min(user['referrals'], task['required'])
            task['link'] = f"https://t.me/s4ntor1_bot/ssss?startapp={telegram_id}"
        else:
            task['progress'] = None

    return jsonify({"tasks": tasks})

@app.route('/tasks', methods=['POST'])
def complete_task_endpoint():
    telegram_id = request.json.get('telegram_id') or session.get('telegram_id')
    task_id = request.json.get('task_id')
    if not telegram_id or not task_id:
        return jsonify({"message": "telegram_id and task_id required"}), 400

    user = get_user(telegram_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute("SELECT reward, required FROM tasks WHERE task_id = ?", (task_id,))
    task = c.fetchone()
    if not task:
        conn.close()
        return jsonify({"message": "Task not found"}), 404

    reward, required = task
    if required is not None:
        if user['referrals'] < required:
            conn.close()
            return jsonify({"message": "Not enough referrals"}), 400

    c.execute("SELECT completed FROM user_tasks WHERE telegram_id = ? AND task_id = ?", 
              (telegram_id, task_id))
    completed = c.fetchone()
    if completed and completed[0] == 1:
        conn.close()
        return jsonify({"message": "Task already completed"}), 400

    c.execute("INSERT OR REPLACE INTO user_tasks (telegram_id, task_id, completed) VALUES (?, ?, 1)", 
              (telegram_id, task_id))
    c.execute("UPDATE users SET banana_count = banana_count + ? WHERE telegram_id = ?", 
              (reward, telegram_id))
    c.execute("SELECT banana_count FROM users WHERE telegram_id = ?", (telegram_id,))
    banana_count = float(c.fetchone()[0])
    conn.commit()
    conn.close()
    
    return jsonify({"banana_count": banana_count})

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)