# Cơ chế Trigger Check-in qua Socket.IO

Tài liệu này mô tả chi tiết cách thức hoạt động và hướng dẫn sử dụng cơ chế kích hoạt check-in (nhận diện khuôn mặt) từ Web Server (Render/Cloud) xuống Raspberry Pi thông qua Socket.IO.

## 1. Vấn đề & Giải pháp

### Vấn đề cũ (HTTP Request)

Trước đây, hệ thống sử dụng giao thức HTTP POST để Web Server gọi trực tiếp tới IP của Raspberry Pi (`http://192.168.1.x:5000/trigger-checkin`).

- **Nhược điểm:**
  - Không hoạt động khi Web Server được deploy lên Cloud (Render, Vercel, Heroku) vì Cloud không thể nhìn thấy IP nội bộ (LAN) của Raspberry Pi.
  - Yêu cầu cấu hình Port Forwarding trên Router (rủi ro bảo mật).
  - Phụ thuộc vào IP tĩnh của Raspberry Pi.

### Giải pháp mới (Socket.IO)

Sử dụng giao thức WebSocket (thông qua thư viện Socket.IO) để thiết lập kênh giao tiếp hai chiều thời gian thực.

## 2. Nguyên lý hoạt động

Mô hình hoạt động dựa trên cơ chế **Pub/Sub (Publish/Subscribe)**:

1.  **Kết nối (Connection):**

    - **Raspberry Pi (Client):** Khi khởi động, Pi chủ động tạo một kết nối WebSocket tới Web Server (ví dụ: `https://tuthuociot.onrender.com`).
    - Kết nối này được duy trì liên tục (Persistent Connection). Vì Pi là người chủ động kết nối ra ngoài, nên không bị chặn bởi Firewall hay NAT của mạng gia đình.

2.  **Lắng nghe (Listening):**

    - Raspberry Pi đăng ký lắng nghe sự kiện có tên là `triggerCheckin`.

3.  **Kích hoạt (Triggering):**

    - Khi đến giờ uống thuốc, `AlertScheduler` trên Web Server sẽ phát (emit) sự kiện `triggerCheckin` tới tất cả các client đang kết nối.

4.  **Xử lý (Handling):**
    - Raspberry Pi nhận được sự kiện `triggerCheckin`.
    - Hàm callback trên Pi được kích hoạt -> Gọi `start_checkin_process()`.
    - Camera bật lên, cửa sổ video hiển thị trên màn hình Pi, và quá trình nhận diện bắt đầu.

## 3. Cấu trúc Code

### Phía Server (Node.js)

File: `utils/alertScheduler.js`

```javascript
// Khi đến giờ hẹn
triggerRaspberryPi() {
  // Gửi sự kiện tới toàn bộ client đang kết nối
  this.io.emit("triggerCheckin", { timestamp: Date.now() });
}
```

### Phía Client (Python - Raspberry Pi)

File: `image_processing/main.py`

```python
# Khởi tạo kết nối
sio = socketio.Client()
sio.connect(SERVER_URL)

# Đăng ký lắng nghe sự kiện
@sio.event
def triggerCheckin(data):
    print(f"Received triggerCheckin event: {data}")
    # Bật camera và logic nhận diện
    start_checkin_process()
```

## 4. Hướng dẫn kiểm thử (Testing)

Để kiểm tra xem kết nối có hoạt động hay không mà không cần đợi đến giờ uống thuốc:

1.  **Khởi động Web Server:**

    - Đảm bảo Server đang chạy (Localhost hoặc trên Render).

2.  **Khởi động Raspberry Pi Client:**

    - Chạy lệnh: `python image_processing/main.py`
    - Quan sát log, phải thấy dòng: `Connected to Web Server via Socket.IO`.

3.  **Trigger thủ công (Optional):**

    - Bạn có thể tạo một nút bấm tạm thời trên giao diện Web hoặc dùng Postman gửi request tới API test (nếu có) để Server emit sự kiện `triggerCheckin`.
    - Hoặc đơn giản là chỉnh giờ uống thuốc gần với hiện tại để Scheduler tự chạy.

4.  **Kết quả mong đợi:**
    - Trên màn hình Raspberry Pi xuất hiện cửa sổ Camera.
    - Log trên Pi hiện: `Starting check-in process...`.

## 5. Lưu ý quan trọng

- **URL Server:** Đảm bảo biến môi trường `SERVER_URL` trong file `.env` (hoặc mặc định trong code Python) trỏ đúng về địa chỉ Web Server của bạn (VD: `https://tuthuociot-minhthien.onrender.com`).
- **Mạng:** Raspberry Pi cần có kết nối Internet để kết nối tới Server.
