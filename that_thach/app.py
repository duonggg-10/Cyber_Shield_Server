import os
import json
import random
import logging
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from bytez import Bytez
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# API Key hardcoded
BYTEZ_API_KEY = "229e25528918a3f8bf259a56fed364e6" 
sdk = Bytez(BYTEZ_API_KEY)

# --- ĐỔI MODEL SANG GEMINI 2.5 FLASH LITE ---
model = sdk.model("google/gemini-2.5-flash-lite")

room_data = {}

def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0]
    return request.remote_addr

def load_local_data():
    try:
        data_path = os.path.join(os.path.dirname(__file__), 'data.json')
        with open(data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading JSON: {e}")
        return {"truth": ["Lỗi tải dữ liệu"], "dare": ["Lỗi tải dữ liệu"]}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/get-question', methods=['POST'])
def get_question():
    data = request.json
    q_type = data.get('type', 'truth')
    is_ai = data.get('is_ai', False)
    
    if not is_ai:
        local_data = load_local_data()
        questions = local_data.get(q_type, [])
        return jsonify({"question": random.choice(questions)})
    else:
        # --- PROMPT NGẮN GỌN, VÔ TRI ---
        prompt = f"""Bạn là quản trò GenZ lớp 10 phòng Tin học.
Tạo 1 câu {'Thật (câu hỏi)' if q_type == 'truth' else 'Thách (hành động)'}.

YÊU CẦU:
- CỰC NGẮN (Dưới 15 từ).
- Ngôn ngữ: GenZ, vô tri, hài hước, 'suy'.
- Bối cảnh: Ngồi tại máy tính trường.
- Chỉ trả về nội dung câu, không dẫn chuyện."""
        
        try:
            results = model.run([{"role": "user", "content": prompt}])
            
            logger.info(f"AI Gemini Output: {results.output}")

            if results.error:
                local_data = load_local_data()
                return jsonify({"question": f"(AI bận): {random.choice(local_data.get(q_type, []))}"})
            
            if results.output:
                # Trích xuất content nếu là dict hoặc lấy trực tiếp nếu là string
                if isinstance(results.output, dict):
                    question_text = results.output.get('content', str(results.output))
                else:
                    question_text = results.output
                
                return jsonify({"question": question_text})
            
            return jsonify({"question": "AI đang 'suy'..."})
            
        except Exception as e:
            logger.error(f"AI Crash: {str(e)}")
            return jsonify({"question": "AI 'đột quỵ' rồi, chọn Local đi!"})

@socketio.on('join_room')
def handle_join():
    ip = get_client_ip()
    if ip not in room_data:
        room_data[ip] = {"players": [], "current_index": -1}
    emit('update_players', room_data[ip]['players'])

@socketio.on('update_player_list')
def handle_update_players(players):
    ip = get_client_ip()
    if ip not in room_data:
        room_data[ip] = {}
    room_data[ip]['players'] = players
    emit('update_players', players, broadcast=True, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5001)