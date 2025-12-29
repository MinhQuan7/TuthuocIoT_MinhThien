# Hướng dẫn Cài đặt & Chạy Module Xử lý Hình ảnh (Image Processing)

Module này đảm nhiệm chức năng nhận diện khuôn mặt sử dụng Camera, phục vụ cho tính năng điểm danh hoặc xác thực người dùng trên thiết bị Tủ Thuốc AIoT.

## 1. Yêu cầu hệ thống (Prerequisites)

- **Python**: Phiên bản 3.8 đến 3.11 (Khuyên dùng 3.10).
- **CMake**: Cần thiết để biên dịch thư viện `dlib` (thư viện nền của `face_recognition`).
- **Visual Studio Build Tools** (Đối với Windows): Cần cài đặt "Desktop development with C++" để biên dịch `dlib`.

## 2. Cài đặt Môi trường (Windows)

### Bước 1: Cài đặt các công cụ cần thiết

1.  **Python**: Tải và cài đặt từ [python.org](https://www.python.org/). Nhớ tích chọn **"Add Python to PATH"**.
2.  **CMake**: Tải và cài đặt từ [cmake.org](https://cmake.org/download/). Chọn **"Add CMake to the system PATH"** khi cài đặt.
3.  **Visual Studio Build Tools**:
    - Tải từ [Visual Studio Downloads](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
    - Khi cài đặt, chọn workload **"Desktop development with C++"**.

### Bước 2: Thiết lập thư mục dự án

Mở Terminal (Command Prompt hoặc PowerShell) và di chuyển vào thư mục `image_processing`:

```bash
cd image_processing
```

### Bước 3: Tạo môi trường ảo (Virtual Environment)

Khuyên dùng môi trường ảo để tránh xung đột thư viện:

```bash
python -m venv venv
```

Kích hoạt môi trường ảo:

- **Windows (Command Prompt):**
  ```cmd
  venv\Scripts\activate
  ```
- **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate
  ```
- **Linux/MacOS:**
  ```bash
  source venv/bin/activate
  ```

### Bước 4: Cài đặt thư viện

Chạy lệnh sau để cài đặt các thư viện từ `requirements.txt`:

```bash
pip install -r requirements.txt
```

> **Lưu ý nếu gặp lỗi cài đặt `dlib`:**
> Nếu lệnh trên thất bại ở bước cài `dlib` hoặc `face_recognition`, hãy thử cài thủ công `dlib` trước:
>
> ```bash
> pip install cmake
> pip install dlib
> ```
>
> Sau đó chạy lại lệnh `pip install -r requirements.txt`.

## 3. Cấu hình (Configuration)

1.  Copy file `.env.example` thành `.env`:
    ```bash
    copy .env.example .env
    ```
2.  Mở file `.env` và chỉnh sửa các thông số nếu cần:
    - `SERVER_URL`: Địa chỉ của Web Server chính (mặc định `http://localhost:3000`).
    - `DEVICE_ID`: ID định danh của thiết bị (ví dụ: `rasp_pi_01`).
    - `CHECKIN_DURATION`: Thời gian (giây) cho mỗi phiên quét khuôn mặt (mặc định `3600`).
    - `CAMERA_INDEX`: Chỉ số của Camera (0 là camera mặc định/webcam, 1 là camera gắn ngoài).

## 4. Chạy ứng dụng

Đảm bảo Web Server chính (Node.js) đang chạy trước. Sau đó chạy lệnh:

```bash
python main.py
```

Nếu thấy thông báo server Flask khởi động (thường ở port 5000), nghĩa là module đã sẵn sàng nhận lệnh từ Web Server.

## 5. Troubleshooting (Sửa lỗi thường gặp)

- **Lỗi `ModuleNotFoundError: No module named 'face_recognition'`**:

  - Đảm bảo bạn đã kích hoạt môi trường ảo (`venv`) trước khi chạy.
  - Kiểm tra lại quá trình cài đặt `dlib`.

- **Lỗi không mở được Camera**:

  - Kiểm tra quyền truy cập Camera trên Windows/Linux.
  - Thử thay đổi `CAMERA_INDEX` trong file `.env` thành `1` hoặc `-1`.

- **Lỗi kết nối tới Server**:
  - Kiểm tra `SERVER_URL` trong `.env`.
  - Đảm bảo Server Node.js đang chạy cùng mạng.

## 6. Cấu trúc thư mục

- `main.py`: File chính khởi chạy Flask server và luồng xử lý camera.
- `face_utils.py`: Chứa các hàm xử lý nhận diện khuôn mặt, tải ảnh từ server.
- `requirements.txt`: Danh sách thư viện cần thiết.
