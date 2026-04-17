import os
import requests
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit
from datetime import datetime
from werkzeug.utils import secure_filename

from bytez import Bytez

# Config
basedir = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__)
app.config['SECRET_KEY'] = 'us-secret-key-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///us.db'
app.config['UPLOAD_FOLDER'] = os.path.join(basedir, 'static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 512 * 1024 * 1024  # 512MB max

# AI Config
BYTEZ_KEY = "0027b2bc29f17a05b5c44c5015af5bee"
sdk = Bytez(BYTEZ_KEY)

AI_MODELS = {
    "gpt-5": "openai/gpt-5",
    "claude-4.6": "anthropic/claude-opus-4-6",
    "gemini-2.5": "google/gemini-2.5-pro",
    "gpt-4o": "openai/gpt-4o"
}

# Models
db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@socketio.on('connect')
def handle_connect():
    emit('system_alert', {
        'title': 'System Online', 
        'msg': 'Dương OS has been loaded successfully.'
    }, broadcast=True)

@socketio.on('system_ping')
def handle_ping():
    emit('system_alert', {
        'title': 'Ping!', 
        'msg': 'System is active and responsive.'
    }, broadcast=True)

class Photo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(300), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    date = db.Column(db.String(20), nullable=False) # YYYY-MM-DD
    type = db.Column(db.String(20), default='date')

class Location(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(200))

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False) # food, gift, travel, other
    date = db.Column(db.DateTime, default=datetime.now)
    note = db.Column(db.String(200))

class SystemSetting(db.Model):
    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.String(500))

class AiMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(20), nullable=False) # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    model = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now)

# Helpers
def extract_yt_id(url):
    if not url: return 'kYgGwJVmjqg'
    if 'v=' in url:
        return url.split('v=')[1].split('&')[0]
    elif 'youtu.be/' in url:
        return url.split('youtu.be/')[1]
    return url # Assume it's already an ID

def get_song_ids():
    # Priority: DB setting -> File -> Default
    ids = []
    try:
        # Check DB first (usually for single override)
        setting = SystemSetting.query.get('song_id')
        if setting: 
            ids.append(extract_yt_id(setting.value))
            return ids

        # Check File for multiple songs
        with open(os.path.join(basedir, 'song.txt'), 'r') as f:
            for line in f:
                url = line.strip()
                if url:
                    ids.append(extract_yt_id(url))
    except Exception as e:
        print(f"Error reading songs: {e}")
    
    return ids if ids else ['kYgGwJVmjqg']

# Routes
@app.route('/')
def index():
    photos = Photo.query.order_by(Photo.created_at.desc()).all()
    song_ids = get_song_ids()
    
    # Simple system username
    name_setting = SystemSetting.query.get('user_name')
    user_name = name_setting.value if name_setting else "Dương"
    
    return render_template('index.html', photos=photos, song_ids=song_ids, user_name=user_name)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi', 'webm'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload():
    files = []
    if 'files[]' in request.files:
        files = request.files.getlist('files[]')
    elif 'photo' in request.files:
        files = [request.files['photo']]
    
    if not files:
        return jsonify({'error': 'No files part'}), 400
    
    uploaded_files = []
    
    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}")
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            
            photo = Photo(filename=filename)
            db.session.add(photo)
            db.session.flush()
            uploaded_files.append({
                'id': photo.id, 
                'filename': filename,
                'type': filename.rsplit('.', 1)[1].lower()
            })
    
    if uploaded_files:
        db.session.commit()
        # Real-time sync
        socketio.emit('sync_new_media', {'media': uploaded_files})
        return jsonify({'success': True, 'new_media': uploaded_files})
    
    return jsonify({'error': 'No valid files uploaded'}), 400

@app.route('/api/photos/<int:id>', methods=['DELETE'])
def delete_photo(id):
    photo = Photo.query.get_or_404(id)
    try:
        # Delete file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], photo.filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"File delete error (ignored): {e}")

        # Delete from DB
        db.session.delete(photo)
        db.session.commit()
        
        socketio.emit('sync_delete_media', {'id': id})
        return jsonify({'success': True})
    except Exception as e:
        print(f"Delete API Error: {e}")
        return jsonify({'error': str(e)}), 500

# --- NOTE API ---
@app.route('/api/notes', methods=['GET'])
def get_notes():
    notes = Note.query.order_by(Note.created_at.desc()).all()
    return jsonify([{'id': n.id, 'content': n.content, 'date': n.created_at.strftime('%d/%m/%Y')} for n in notes])

@app.route('/api/notes', methods=['POST'])
def add_note():
    data = request.json
    if not data or 'content' not in data:
        return jsonify({'error': 'No content'}), 400
    new_note = Note(content=data['content'])
    db.session.add(new_note)
    db.session.commit()
    socketio.emit('sync_note', {'action': 'add'}) # Bonus sync note
    return jsonify({'success': True})

@app.route('/api/notes/<int:id>', methods=['DELETE'])
def delete_note(id):
    note = Note.query.get_or_404(id)
    db.session.delete(note)
    db.session.commit()
    socketio.emit('sync_note', {'action': 'delete'}) # Bonus sync note
    return jsonify({'success': True})

# --- CALENDAR API ---
@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    return jsonify([{'id': e.id, 'title': e.title, 'date': e.date, 'type': e.type} for e in events])

@app.route('/api/events', methods=['POST'])
def add_event():
    data = request.json
    new_event = Event(title=data['title'], date=data['date'], type=data.get('type', 'date'))
    db.session.add(new_event)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/events/<int:id>', methods=['DELETE'])
def delete_event(id):
    event = Event.query.get_or_404(id)
    db.session.delete(event)
    db.session.commit()
    return jsonify({'success': True})

# --- MAPS API ---
@app.route('/api/locations', methods=['GET'])
def get_locations():
    locs = Location.query.all()
    return jsonify([{'id': l.id, 'name': l.name, 'lat': l.lat, 'lng': l.lng, 'desc': l.description} for l in locs])

@app.route('/api/locations', methods=['POST'])
def add_location():
    data = request.json
    new_loc = Location(name=data['name'], lat=data['lat'], lng=data['lng'], description=data.get('desc', ''))
    db.session.add(new_loc)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/locations/<int:id>', methods=['DELETE'])
def delete_location(id):
    loc = Location.query.get_or_404(id)
    db.session.delete(loc)
    db.session.commit()
    return jsonify({'success': True})

# --- WALLET API ---
@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    txs = Transaction.query.order_by(Transaction.date.desc()).all()
    return jsonify([{
        'id': t.id, 
        'title': t.title, 
        'amount': t.amount, 
        'category': t.category, 
        'date': t.date.strftime('%Y-%m-%d %H:%M'),
        'note': t.note
    } for t in txs])

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    data = request.json
    try:
        new_tx = Transaction(
            title=data['title'],
            amount=float(data['amount']),
            category=data['category'],
            note=data.get('note', '')
        )
        if 'date' in data and data['date']:
            new_tx.date = datetime.strptime(data['date'], '%Y-%m-%d')
            
        db.session.add(new_tx)
        db.session.commit()
        socketio.emit('sync_wallet', {'action': 'add'})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/transactions/<int:id>', methods=['DELETE'])
def delete_transaction(id):
    tx = Transaction.query.get_or_404(id)
    db.session.delete(tx)
    db.session.commit()
    socketio.emit('sync_wallet', {'action': 'delete'})
    return jsonify({'success': True})

# --- SYSTEM SETTINGS API ---
@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = SystemSetting.query.all()
    return jsonify({s.key: s.value for s in settings})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json
    for key, value in data.items():
        setting = SystemSetting.query.get(key)
        if setting:
            setting.value = value
        else:
            new_setting = SystemSetting(key=key, value=value)
            db.session.add(new_setting)
    db.session.commit()
    
    # Real-time sync
    socketio.emit('sync_settings', data)
    
    return jsonify({'success': True})

# --- SETTINGS API (Legacy/Specific) ---
@app.route('/api/settings/song', methods=['POST'])
def update_song():
    # Forward to generic settings
    data = request.json
    if not data or 'song_id' not in data:
        return jsonify({'error': 'No song_id provided'}), 400
    
    url = data['song_id']
    new_id = url
    if 'v=' in url:
        new_id = url.split('v=')[1].split('&')[0]
    elif 'youtu.be/' in url:
        new_id = url.split('youtu.be/')[1]
        
    # Save to DB instead of file
    setting = SystemSetting.query.get('song_id')
    if setting:
        setting.value = new_id
    else:
        db.session.add(SystemSetting(key='song_id', value=new_id))
    db.session.commit()
    
    return jsonify({'success': True, 'new_id': new_id})

# --- SYSTEM INFO API ---
@app.route('/api/system/info')
def get_system_info():
    import psutil
    disk = psutil.disk_usage('/')
    mem = psutil.virtual_memory()
    
    # Đếm số lượng tài nguyên
    photo_count = Photo.query.count()
    note_count = Note.query.count()
    
    return jsonify({
        "ip": request.remote_addr,
        "storage": {
            "total": round(disk.total / (1024**3), 2),
            "used": round(disk.used / (1024**3), 2),
            "free": round(disk.free / (1024**3), 2),
            "percent": disk.percent
        },
        "ram": {
            "percent": mem.percent
        },
        "stats": {
            "photos": photo_count,
            "notes": note_count
        }
    })
@app.route('/api/ai/history', methods=['GET'])
def get_ai_history():
    messages = AiMessage.query.order_by(AiMessage.created_at.asc()).all()
    return jsonify([{"role": m.role, "content": m.content, "model": m.model} for m in messages])

@app.route('/api/ai/clear', methods=['POST'])
def clear_ai_history():
    AiMessage.query.delete()
    db.session.commit()
    return jsonify({"success": True})

@app.route('/api/ai', methods=['POST'])
def ai_assistant():
    try:
        data = request.json
        prompt = data.get('prompt', '')
        model_key = data.get('model', 'gpt-4o')
        
        # Load previous history from DB (last 10 messages for context)
        prev_messages = AiMessage.query.order_by(AiMessage.created_at.desc()).limit(10).all()
        history = [{"role": m.role, "content": m.content} for m in reversed(prev_messages)]
        
        target_model = AI_MODELS.get(model_key, AI_MODELS['gpt-4o'])
        model = sdk.model(target_model)
        
        messages = history + [{"role": "user", "content": prompt}]
        results = model.run(messages)
        
        # Parse output
        res_output = getattr(results, 'output', results)
        if isinstance(res_output, dict):
            output = res_output.get('content', str(res_output))
        elif isinstance(res_output, list) and len(res_output) > 0:
            item = res_output[0]
            output = item.get('content', str(item)) if isinstance(item, dict) else str(item)
        else:
            output = str(res_output)

        # Save to DB
        user_msg = AiMessage(role='user', content=prompt, model=model_key)
        ai_msg = AiMessage(role='assistant', content=output, model=model_key)
        db.session.add(user_msg)
        db.session.add(ai_msg)
        db.session.commit()

        return jsonify({"output": output})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- WEATHER PROXY ---
@app.route('/api/weather', methods=['GET'])
def get_weather():
    try:
        lat = float(request.args.get('lat', '10.82'))
        lon = float(request.args.get('lon', '106.63'))
        
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code&timezone=auto"
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        # Fix InsecureRequestWarning by enabling verify or suppressing if needed
        r = requests.get(url, headers=headers, timeout=5, verify=True) 
        
        if r.status_code == 200:
            return jsonify(r.json())
            
        print(f"Weather API Error: {r.status_code} - {r.text}")
        return jsonify({'error': 'Provider error', 'details': r.text}), 502
    except Exception as e:
        print(f"Weather API Exception: {e}")
        return jsonify({'error': str(e)}), 500

# Init DB
with app.app_context():
    db.create_all()
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])

if __name__ == '__main__':
    socketio.run(app, debug=True, port=7000)