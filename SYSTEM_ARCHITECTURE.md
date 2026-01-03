# TÀI LIỆU KIẾN TRÚC HỆ THỐNG TỦ THUỐC AIoT

## 1. Tổng Quan Hệ Thống

Hệ thống Tủ Thuốc AIoT là một giải pháp tích hợp giữa phần mềm quản lý (Web), thiết bị biên (Raspberry Pi AI) và thiết bị điều khiển IoT (ESP32). Hệ thống hoạt động theo mô hình tập trung, trong đó Web Server đóng vai trò là bộ não trung tâm điều phối dữ liệu và logic nghiệp vụ.

### Các thành phần chính:

1.  **Web Server (Node.js)**: Trung tâm xử lý logic, quản lý dữ liệu, lập lịch nhắc thuốc và cung cấp giao diện người dùng.
2.  **Raspberry Pi (AI Module)**: Thiết bị biên xử lý hình ảnh, nhận diện khuôn mặt người dùng để xác nhận uống thuốc (Check-in).
3.  **IoT Controller (ESP32)**: Điều khiển phần cứng tủ thuốc (Đèn LED, Còi báo, Động cơ) thông qua nền tảng E-Ra IoT.
4.  **Database**: Lưu trữ thông tin người dùng, lịch uống thuốc, thuốc và lịch sử hoạt động.

---

## 2. Luồng Hoạt Động Chi Tiết (System Workflow)

### 2.1. Luồng Quản Lý Người Dùng & Đồng Bộ Dữ Liệu (Sync Flow)

Đây là quy trình đảm bảo Raspberry Pi luôn có dữ liệu khuôn mặt mới nhất để nhận diện.

1.  **Thêm/Sửa/Xóa User trên Web**:
    - Admin thao tác trên giao diện Web.
    - Web Client gửi Socket event (`saveNewUser`, `deleteUser`) tới Server.
    - Server cập nhật Database.
2.  **Kích hoạt Đồng bộ (Trigger Sync)**:
    - Ngay sau khi Database thay đổi, Server phát sự kiện `syncFacesRequest` qua giao thức **Socket.IO** tới tất cả client đang kết nối.
3.  **Raspberry Pi Xử lý**:
    - Script Python (`main.py`) trên Pi lắng nghe sự kiện `syncFacesRequest`.
    - Pi gọi API `GET /api/users/images` về Server để lấy danh sách user mới nhất.
    - Pi so sánh danh sách này với thư mục cục bộ (`known_faces/`):
      - **Tải mới**: Nếu có user mới, tải ảnh về và encode khuôn mặt.
      - **Xóa bỏ**: Nếu user đã bị xóa trên Server, Pi tự động xóa thư mục tương ứng để tránh nhận diện sai.

### 2.2. Luồng Nhắc Thuốc & Điều Khiển IoT (Alert Flow)

Quy trình tự động nhắc nhở khi đến giờ uống thuốc.

1.  **Lập lịch (Scheduler)**:
    - `AlertScheduler` trên Server chạy định kỳ (mỗi phút) quét Database.
    - Kiểm tra các lịch uống thuốc (`schedules`) so với giờ hiện tại.
2.  **Phát Cảnh Báo (Trigger Alert)**:
    - Nếu đến giờ, Server sử dụng `EraIotClient` để gửi HTTP Request tới **E-Ra IoT Platform**.
    - **E-Ra Platform** đẩy lệnh xuống thiết bị ESP32 thông qua giao thức MQTT/HTTP.
    - **ESP32**: Bật Đèn LED và Còi báo động để thu hút sự chú ý.
3.  **Thông báo Web**:
    - Server đồng thời gửi Socket event `reminderAlert` tới giao diện Web để hiển thị popup nhắc nhở.

### 2.3. Luồng Nhận Diện & Xác Nhận Uống Thuốc (Check-in Flow)

Quy trình xác nhận người dùng đã thực hiện uống thuốc.

1.  **Phát hiện khuôn mặt**:
    - Camera trên Raspberry Pi liên tục thu hình.
    - Module `FaceRecognizer` (sử dụng thư viện `face_recognition` & `OpenCV`) phân tích hình ảnh.
2.  **Nhận diện**:
    - So khớp khuôn mặt với dữ liệu đã encode trong thư mục `known_faces`.
    - Nếu độ chính xác > ngưỡng cho phép => Xác định được `userId`.
3.  **Gửi xác nhận (Confirm)**:
    - Pi gửi HTTP POST request tới `SERVER_URL/api/checkin/confirm` với body `{ userId: ... }`.
4.  **Xử lý Logic Check-in**:
    - Server nhận request, kiểm tra giờ hiện tại so với lịch uống thuốc của user đó.
    - **Đúng giờ**: Trong khoảng ±1 giờ so với lịch => Ghi nhận trạng thái "Taken" (Đúng giờ).
    - **Trễ**: Quá 1 giờ nhưng dưới 4 giờ => Ghi nhận trạng thái "Late" (Trễ).
    - **Cập nhật DB**: Lưu trạng thái vào lịch sử.
    - **Phản hồi**: Server gửi Socket event cập nhật lại giao diện Web (tắt thông báo, cập nhật thống kê).

---

## 3. Kiến Trúc Cơ Sở Dữ Liệu (Database Architecture)

Hệ thống sử dụng kiến trúc dữ liệu linh hoạt, hỗ trợ cả File-based (cho môi trường dev/local) và Cloud Database (cho production).

### 3.1. Công nghệ lưu trữ

- **Local Mode**: Sử dụng **JSON Files** (`heThongData.json`).
  - Ưu điểm: Đơn giản, không cần cài đặt database server, dễ backup/restore thủ công.
  - Cơ chế: Class `DataManager` đọc/ghi trực tiếp file text.
- **Production Mode**: Sử dụng **MongoDB** (thông qua `MongoDataManager`).
  - Ưu điểm: Hiệu năng cao, bảo mật, hỗ trợ truy vấn phức tạp, lưu trữ trên Cloud (MongoDB Atlas).
  - Cơ chế: Dữ liệu được lưu dưới dạng một Document lớn (Mixed Type) để giữ tương thích cấu trúc với file JSON, hoặc có thể tách collection nếu cần mở rộng.

### 3.2. Cấu trúc dữ liệu chính (Schema)

Dữ liệu được tổ chức dạng cây (Tree structure):

- `users`: Danh sách người dùng (ID, Tên, Avatar URLs).
- `medicines`: Kho thuốc (Tên, Số lượng, Hạn sử dụng, Liều dùng).
- `schedules`: Lịch uống thuốc (Liên kết UserID - MedicineID, Giờ uống, Ngày trong tuần).
- `alerts`: Lịch sử cảnh báo và thông báo hệ thống.
- `statistics`: Dữ liệu thống kê tuân thủ điều trị.

---

## 4. Công Nghệ & Giao Thức Giao Tiếp (Communication Stack)

Để Web Server có thể "nói chuyện" và điều khiển Raspberry Pi, hệ thống sử dụng mô hình lai (Hybrid Communication):

### 4.1. Web Server -> Raspberry Pi (Thông báo & Điều khiển)

- **Công nghệ**: **Socket.IO** (Websocket wrapper).
- **Tại sao chọn?**: Cần tính năng Real-time (thời gian thực). Khi Admin xóa user, Pi cần biết _ngay lập tức_ mà không cần phải hỏi (poll) server liên tục.
- **Cách thức**:
  - Server: `io.emit('syncFacesRequest', payload)`
  - Pi (Client): `sio.on('syncFacesRequest', callback)`

### 4.2. Raspberry Pi -> Web Server (Gửi dữ liệu)

- **Công nghệ**: **RESTful API** (HTTP POST/GET).
- **Tại sao chọn?**: Đơn giản, chuẩn mực cho việc gửi dữ liệu giao dịch.
- **Cách thức**:
  - Pi dùng thư viện `requests` của Python.
  - Endpoint:
    - `POST /api/checkin/confirm`: Gửi thông tin người vừa nhận diện.
    - `GET /api/users/images`: Tải danh sách ảnh để training.

### 4.3. Web Server -> IoT Hardware (ESP32)

- **Công nghệ**: **HTTP Request (via Third-party Platform)**.
- **Trung gian**: E-Ra IoT Platform.
- **Cách thức**:
  - Server không giao tiếp trực tiếp với ESP32 (do ESP32 thường nằm sau NAT/Firewall).
  - Server gọi API của E-Ra (`backend.eoh.io`).
  - E-Ra Platform duy trì kết nối với ESP32 và đẩy lệnh xuống.

---

## 5. Tổng Kết Tech Stack

| Thành phần    | Công nghệ / Thư viện             | Vai trò                         |
| :------------ | :------------------------------- | :------------------------------ |
| **Backend**   | Node.js, Express                 | Server xử lý chính              |
| **Real-time** | Socket.IO                        | Giao tiếp thời gian thực Web-Pi |
| **Database**  | JSON / MongoDB                   | Lưu trữ dữ liệu                 |
| **AI/Edge**   | Python, OpenCV, Face_recognition | Xử lý ảnh, nhận diện khuôn mặt  |
| **IoT**       | ESP32, E-Ra Platform             | Điều khiển phần cứng tủ thuốc   |
| **Frontend**  | HTML5, CSS3, JS (Vanilla)        | Giao diện người dùng            |
