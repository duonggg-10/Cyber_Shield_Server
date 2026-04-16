# app.py
# IMPORTANT: Monkey-patch for eventlet is crucial for WebSocket compatibility
import eventlet
eventlet.monkey_patch()

import os
import logging
from dotenv import load_dotenv
load_dotenv()

# Import các thư viện cần thiết
from eventlet import wsgi
from flask import Flask, jsonify, render_template, request, abort
import re
from flask_cors import CORS
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.middleware.proxy_fix import ProxyFix # Import ProxyFix
from socketio import WSGIApp

from extensions import limiter

# Import các ứng dụng con và các instance socketio của chúng
from api.analyze import analyze_endpoint
from api.admin import admin_endpoint
from api.utils import print_masked_api_keys # Import helper function
from duongdev.TO1_Chat.app import app as to1_chat_app, socketio as to1_chat_socketio
from duongdev.anmqpan.app import app as qpan_app, socketio as qpan_socketio
from duongdev.minhthy.app import app as minhthy_app, socketio as minhthy_socketio
from duongdev.share.app import app as share_app, socketio as share_socketio
from duongdev.macos.app import app as us_app, socketio as us_socketio # UPDATED: From us to macos
from duongdev.that_thach.app import app as that_thach_app, socketio as that_thach_socketio # NEW: That Thach App
from duongdev.tarot.app import app as tarot_app # NEW: Tarot App

GOOGLE_API_KEYS_STR = os.environ.get('GOOGLE_API_KEYS')
if not GOOGLE_API_KEYS_STR:
    raise ValueError("Biến môi trường GOOGLE_API_KEYS là bắt buộc.")
GOOGLE_API_KEYS = [key.strip() for key in GOOGLE_API_KEYS_STR.split(',') if key.strip()]
print_masked_api_keys(GOOGLE_API_KEYS, "GOOGLE_API_KEYS") # Sử dụng hàm helper

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Middleware tùy chỉnh để thêm Flask app context ---
class FlaskAppMiddleware:
    """
    Middleware này sẽ "tiêm" instance của Flask app vào môi trường WSGI.
    Điều này cần thiết để Flask-SocketIO có thể tạo app context khi xử lý event.
    """
    def __init__(self, wsgi_app, flask_app):
        self.wsgi_app = wsgi_app
        self.flask_app = flask_app

    def __call__(self, environ, start_response):
        environ['flask.app'] = self.flask_app
        return self.wsgi_app(environ, start_response)

# --- Ứng dụng Flask gốc ---
app = Flask(__name__)

# [SECURITY CRITICAL] Cấu hình ProxyFix để nhận diện IP thật từ Cloudflare
# x_for=1: Tin tưởng 1 lớp proxy (Cloudflare) cho header X-Forwarded-For
# x_proto=1: Tin tưởng header X-Forwarded-Proto (https/http)
# x_host=1: Tin tưởng header X-Forwarded-Host
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

CORS(app)

limiter.init_app(app)

app.secret_key = os.environ.get('SECRET_KEY', 'default-secret-key-for-dev-only')
if app.secret_key == 'default-secret-key-for-dev-only':
    logger.warning("Sử dụng SECRET_KEY mặc định. Hãy thay đổi nó trong môi trường production!")

# Đăng ký blueprint cho ứng dụng gốc

@app.before_request
def firewall():
    """Tường lửa nâng cao: Chặn truy cập file nhạy cảm và các mẫu tấn công phổ biến."""
    path = request.path.lower()
    
    # 1. Danh sách đen các file/thư mục nhạy cảm
    sensitive_patterns = [
        r'\.env', r'\.git', r'\.db', r'\.sql', r'\.py', r'\.sh',
        r'secrets/', r'venv/', r'__pycache__', r'requirements\.txt',
        r'config\.json', r'nohup\.out', r'\.log'
    ]
    
    # 2. Các mẫu tấn công phổ biến
    attack_patterns = [
        r'\/wp-', r'\/xmlrpc', r'\/phpmyadmin', r'\/pma', r'\/admin\/', # Quét CMS/Admin
        r'\.\.\/', r'\.\.\\', # Path Traversal
        r'etc\/passwd', r'proc\/self' # Linux system files
    ]
    
    # Kiểm tra
    for pattern in sensitive_patterns + attack_patterns:
        if re.search(pattern, path):
            # CHẶN NGAY LẬP TỨC
            logger.warning(f"🚨 [FIREWALL BLOCK] IP {request.remote_addr} tried to access: {path}")
            abort(403)

app.register_blueprint(analyze_endpoint, url_prefix='/api')
app.register_blueprint(admin_endpoint)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/health')
def health_check():
    return jsonify({
        'status': '🟢 Systems Nominal',
        'hp': '100/100',
        'mana': '∞',
        'latency_ms': 5,
        'service': 'cybershield-backend',
        'note': 'Tế đàn còn ổn'
    })

@app.route('/duongdev')
def duongdev_home():
    return render_template('duongdev.html')

@app.route('/about')
def about_page():
    return render_template('about.html')

# --- Security Headers Middleware ---
@app.after_request
def add_security_headers(response):
    """Thêm các header bảo mật vào mỗi response."""
    # Ngăn trình duyệt tự ý thay đổi content-type (MIME-sniffing).
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Ngăn trang web bị nhúng vào iframe trên domain khác (chống clickjacking).
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    
    # Chính sách An toàn Nội dung (Content Security Policy) chi tiết hơn
    # Cho phép các nguồn cần thiết, giải quyết các lỗi "Refused to load/apply"
    csp_policy = (
        "default-src 'self' https://*.youtube.com https://*.ytimg.com;"
        "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://cdnjs.cloudflare.com https://cdn.socket.io https://www.youtube.com https://s.ytimg.com https://cdn.tailwindcss.com;"
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.tailwindcss.com;"
        "img-src 'self' data: https://*.ytimg.com;"
        "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com https://cdnjs.cloudflare.com;"
        "frame-src 'self' https://www.youtube.com;"
        "connect-src 'self' ws: wss: https://cdn.tailwindcss.com;"
    )

    response.headers['Content-Security-Policy'] = csp_policy
    return response

# --- Bọc mỗi ứng dụng con thành một WSGI app hoàn chỉnh (Flask + SocketIO) ---
to1_chat_wsgi_raw = WSGIApp(to1_chat_socketio.server, to1_chat_app)
qpan_wsgi_raw = WSGIApp(qpan_socketio.server, qpan_app)
minhthy_wsgi_raw = WSGIApp(minhthy_socketio.server, minhthy_app)
share_wsgi_raw = WSGIApp(share_socketio.server, share_app) # NEW
us_wsgi_raw = WSGIApp(us_socketio.server, us_app) # NEW: Us App
that_thach_wsgi_raw = WSGIApp(that_thach_socketio.server, that_thach_app) # NEW: That Thach App

# --- Sử dụng middleware tùy chỉnh để thêm app context ---
to1_chat_wsgi = FlaskAppMiddleware(to1_chat_wsgi_raw, to1_chat_app)
qpan_wsgi = FlaskAppMiddleware(qpan_wsgi_raw, qpan_app)
minhthy_wsgi = FlaskAppMiddleware(minhthy_wsgi_raw, minhthy_app)
share_wsgi = FlaskAppMiddleware(share_wsgi_raw, share_app) # NEW
us_wsgi = FlaskAppMiddleware(us_wsgi_raw, us_app) # NEW: Us App
that_thach_wsgi = FlaskAppMiddleware(that_thach_wsgi_raw, that_thach_app) # NEW: That Thach App
tarot_wsgi = FlaskAppMiddleware(tarot_app, tarot_app) # NEW: Tarot App


# --- Tạo bộ điều phối (Dispatcher) để kết hợp tất cả các ứng dụng ---
application = DispatcherMiddleware(app, {
    '/duongdev/to1-chat': to1_chat_wsgi,
    '/duongdev/qpan': qpan_wsgi,
    '/duongdev/minhthy': minhthy_wsgi,
    '/duongdev/share': share_wsgi, # Changed from share_app to share_wsgi
    '/duongdev/macos': us_wsgi, # NEW: Endpoint cho tinh yeu moi
    '/duongdev/that-thach': that_thach_wsgi, # NEW: That Thach
    '/duongdev/tarot': tarot_wsgi, # NEW: Tarot App
})

# --- Error Handlers (chỉ hoạt động cho ứng dụng gốc) ---
@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {str(error)}")
    return jsonify({'error': '💥 500: Quay về phòng thủ. Tế đàn bị tấn công'}), 500


# --- Khởi chạy Server ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    logger.info(f"🚀 Starting combined server on http://localhost:{port}")
    logger.info(f"Truy cập vào Minh Thy qua: http://localhost:{port}/duongdev/minhthy")
    # Sử dụng server của eventlet để chạy bộ điều phối 'application'
    # Điều này đảm bảo các kết nối WebSocket được xử lý đúng cách
    wsgi.server(eventlet.listen(('', port)), application)