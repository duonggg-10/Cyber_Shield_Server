# api/pre_filter.py
import os
import random
from bytez import Bytez

# Import get_dynamic_config từ api.utils để đọc cấu hình động
from api.utils import get_dynamic_config

# Lấy cấu hình từ biến môi trường (chỉ còn lại BYETZ_API_KEYS_STR)
# PRE_FILTER_MODEL_ID sẽ được đọc từ config.json

# Sử dụng lại danh sách API keys của Bytez đã có
BYTEZ_API_KEYS_STR = os.environ.get('BYTEZ_API_KEY')
if not BYTEZ_API_KEYS_STR:
    BYTEZ_API_KEYS = []
else:
    BYTEZ_API_KEYS = [key.strip() for key in BYTEZ_API_KEYS_STR.split(',') if key.strip()]

# Lấy danh sách API keys Google từ biến môi trường
GOOGLE_API_KEYS_STR = os.environ.get('GOOGLE_API_KEYS')
if not GOOGLE_API_KEYS_STR:
    # Print a warning if GOOGLE_API_KEYS is not set, but don't stop execution
    print("🔴 [Pre-filter] Cảnh báo: GOOGLE_API_KEYS chưa được thiết lập. Có thể gặp lỗi khi dùng model Google.")
    GOOGLE_API_KEYS = []
else:
    GOOGLE_API_KEYS = [key.strip() for key in GOOGLE_API_KEYS_STR.split(',') if key.strip()]

def create_pre_filter_prompt(text: str) -> str:
    """Tạo prompt cho model lọc nhanh."""
    return (
        f"Is the following user message trivial, a simple greeting, an expression of thanks, "
        f"or conversational filler that does not require security analysis? "
        f"The message might be in Vietnamese. "
        f"Respond with only the single word 'true' if it is trivial, and 'false' otherwise.\n\n"
        f"Message: \"{text}\""
    )

def is_trivial_message(text: str) -> bool:
    """
    Sử dụng một model AI nhỏ để kiểm tra xem tin nhắn có phải là tin nhắn rác,
    quá đơn giản để phân tích hay không.
    """
    # Không phân tích các tin nhắn quá dài bằng bộ lọc này
    if len(text) > 100 or len(text.split()) > 15:
        return False
        
    if not BYTEZ_API_KEYS:
        print("🔴 [Pre-filter] Lỗi: BYTEZ_API_KEY chưa được thiết lập, không thể chạy bộ lọc nhanh.")
        return False # Mặc định là không phải tin nhắn rác nếu không có key

    try:
        # Đọc PRE_FILTER_MODEL_ID từ config.json
        config = get_dynamic_config()
        pre_filter_model_id = config.get('pre_filter_model_id', 'gemini-1.0-pro') # Mặc định là gemini-1.0-pro
        
        # Chọn một Bytez API key
        selected_bytez_key = random.choice(BYTEZ_API_KEYS)
        sdk = Bytez(selected_bytez_key)

        # Xác định provider key dựa trên model ID
        provider_api_key = None
        if pre_filter_model_id.startswith('gemini') or pre_filter_model_id.startswith('google'):
            if not GOOGLE_API_KEYS:
                print(f"🔴 [Pre-filter] Lỗi: GOOGLE_API_KEYS chưa được thiết lập để dùng model Google: {pre_filter_model_id}.")
                return False
            provider_api_key = random.choice(GOOGLE_API_KEYS)
        # elif pre_filter_model_id.startswith('openai'): # Tạm thời comment lại để nhất quán với lựa chọn hiện tại của người dùng
            # TODO: Add logic here to load and use OPENAI_API_KEYS if needed in the future
            # print(f"🔴 [Pre-filter] Cảnh báo: Model OpenAI '{pre_filter_model_id}' được cấu hình nhưng chưa có logic xử lý OPENAI_API_KEYS.")
            # return False
        
        if not provider_api_key:
            print(f"🔴 [Pre-filter] Lỗi: Không thể tìm thấy provider API key cho model được cấu hình: {pre_filter_model_id}.")
            return False

        model = sdk.model(pre_filter_model_id, provider_api_key) # Sử dụng model từ config.json VÀ provider_api_key
        
        prompt = create_pre_filter_prompt(text)
        
        print(f"➡️  [Pre-filter] Đang kiểm tra tin nhắn đơn giản với {pre_filter_model_id} (thông qua Bytez)...")
        
        res = model.run([{"role": "user", "content": prompt}])

        if res.error:
            print(f"🔴 [Pre-filter] Lỗi từ Bytez SDK: {res.error}. Bỏ qua bộ lọc.")
            return False

        output = res.output
        if isinstance(output, dict) and "content" in output:
            response_text = output['content'].strip().lower()
            print(f"✅ [Pre-filter] Model lọc trả về: '{response_text}'")
            return response_text == 'true'
        else:
            print(f"🔴 [Pre-filter] Định dạng output không mong muốn. Bỏ qua bộ lọc.")
            return False

    except Exception as e:
        print(f"🔴 [Pre-filter] Lỗi ngoại lệ: {e}. Bỏ qua bộ lọc.")
        return False # Nếu có lỗi, coi như không phải tin rác để phân tích sâu hơn
