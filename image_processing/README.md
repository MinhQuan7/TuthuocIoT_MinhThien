# Tủ Thuốc AIoT - Hệ Thống Quản Lý & Nhận Diện Khuôn Mặt

Dự án Tủ Thuốc Thông Minh tích hợp AIoT, bao gồm Web Server quản lý, Module nhận diện khuôn mặt (chạy trên Raspberry Pi/Laptop), và tích hợp Google Drive để lưu trữ ảnh người dùng.

## 📖 Luồng Hoạt Động (Operational Flow)

Hệ thống hoạt động theo quy trình đồng bộ dữ liệu chặt chẽ để đảm bảo tính nhất quán giữa Web quản lý và thiết bị nhận diện tại tủ thuốc:

1.  **Thêm Người Dùng & Chụp Ảnh:**

    - Quản trị viên truy cập Web Interface.
    - Thêm người dùng mới và chụp 5 ảnh mẫu (hoặc tải ảnh lên).
    - Khi bấm **Lưu**, ảnh sẽ được gửi lên **Google Drive** thông qua Google Apps Script.

2.  **Lưu Trữ & Thông Báo:**

    - Web Server (Node.js) nhận lại link ảnh từ Google Drive và lưu thông tin người dùng vào cơ sở dữ liệu.
    - Ngay lập tức, Web Server gửi tín hiệu đến **Module AI (Python)** thông qua API `/sync-faces`.

3.  **Đồng Bộ Dữ Liệu Xuống Thiết Bị (Raspberry Pi):**

    - Module AI nhận tín hiệu, tự động tải ảnh từ các link Google Drive về thư mục `known_faces` trên thiết bị.
    - Hệ thống tự động cập nhật lại model nhận diện mà không cần khởi động lại.

4.  **Nhận Diện & Điểm Danh:**
    - Khi người dùng đứng trước camera tủ thuốc, Module AI nhận diện khuôn mặt.
    - Tên người dùng (Tiếng Việt) được hiển thị trực tiếp trên màn hình (Video Stream).
    - Nếu nhận diện đúng, hệ thống gửi xác nhận về Web Server để ghi nhận lịch sử uống thuốc/điểm danh.

---

## 🛠️ Hướng Dẫn Cài Đặt (Installation)

### 1. Yêu Cầu Hệ Thống

- **Node.js**: v14 trở lên.
- **Python**: v3.8 - v3.11 (Khuyên dùng 3.10).
- **CMake** & **Visual Studio Build Tools** (nếu chạy trên Windows để build thư viện `dlib`).

### 2. Cài Đặt Web Server (Node.js)

Tại thư mục gốc (`GIAODIENWEB/GIAODIENWEB`):

1.  Cài đặt các thư viện:
    ```bash
    npm install
    ```
2.  Cấu hình Google Apps Script (nếu chưa làm):
    - Làm theo hướng dẫn trong file `google_apps_script_upload.txt`.
    - Cập nhật URL Script vào file `public/client.js` (biến `GOOGLE_APPS_SCRIPT_URL`).

### 3. Cài Đặt Module AI (Python)

Tại thư mục `image_processing`:

1.  Tạo môi trường ảo (khuyên dùng):
    ```bash
    python -m venv venv
    # Windows:
    .\venv\Scripts\activate
    # Linux/Mac:
    source venv/bin/activate
    ```
2.  Cài đặt thư viện:

    ```bash
    pip install -r requirements.txt
    ```

    _Lưu ý: File `requirements.txt` đã bao gồm: `opencv-python`, `flask`, `face_recognition`, `requests`, `python-dotenv`, `Pillow` (hỗ trợ font tiếng Việt)._

3.  Cấu hình file `.env` (trong thư mục `image_processing`):
    Tạo file `.env` với nội dung:
    ```env
    SERVER_URL=http://localhost:3000
    CHECKIN_DURATION=3600
    CAMERA_INDEX=0
    ```

---

## 🚀 Hướng Dẫn Sử Dụng (Usage)

Bạn cần chạy song song cả 2 dịch vụ:

### Bước 1: Khởi động Web Server

Mở terminal tại thư mục gốc:

```bash
npm start
# Hoặc nếu dùng nodemon:
npm run dev
```

_Server sẽ chạy tại: `http://localhost:3000`_

### Bước 2: Khởi động Module AI

Mở terminal mới, trỏ vào thư mục `image_processing` (đảm bảo đã activate venv):

```bash
python main.py
```

_AI Server sẽ chạy tại: `http://localhost:5000`_

### Bước 3: Kiểm Tra

1.  Truy cập Web `http://localhost:3000` để quản lý người dùng.
2.  Xem Video Stream từ Camera tại: `http://localhost:5000/video_feed`.
3.  Thử thêm một người dùng mới và quan sát Terminal của Python để thấy quá trình tải ảnh từ Drive về.

---

## ⚠️ Các Vấn Đề Thường Gặp (Troubleshooting)

1.  **Lỗi Font Tiếng Việt trên Camera:**

    - Đảm bảo đã cài thư viện `Pillow`: `pip install Pillow`.
    - Hệ thống sẽ tự động tìm font `arial.ttf` (Windows) hoặc `DejaVuSans.ttf` (Linux/Pi). Nếu không thấy, nó sẽ dùng font mặc định (không dấu).

2.  **Không tải được ảnh từ Drive:**

    - Kiểm tra quyền truy cập của file trên Drive (phải là "Anyone with the link" hoặc "Public").
    - Kiểm tra kết nối mạng của Raspberry Pi.

3.  **Lỗi cài đặt `dlib` / `face_recognition`:**

    - Trên Windows: Cần cài đặt **Visual Studio C++ Build Tools** và **CMake**.
    - Trên Raspberry Pi: Chạy `sudo apt-get install cmake libopenblas-dev liblapack-dev libjpeg-dev`.

4.  **Camera không lên hình:**
    - Kiểm tra `CAMERA_INDEX` trong file `.env`. Thử đổi thành `0`, `1`, hoặc `-1`.
    - Đảm bảo không có ứng dụng nào khác đang chiếm dụng camera.
