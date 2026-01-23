# HƯỚNG DẪN KẾT NỐI MONGODB - TỦ THUỐC AIoT

Tài liệu này hướng dẫn cách kết nối hệ thống Tủ Thuốc AIoT với cơ sở dữ liệu MongoDB.

## 1. Tại sao cần MongoDB?

Mặc định, hệ thống sẽ lưu dữ liệu vào file `data/data.json`. Tuy nhiên, cách này có nhược điểm:
*   Mất dữ liệu khi redeploy (nếu dùng cloud như Render, Heroku).
*   Không tối ưu cho hệ thống lớn.

Kết nối MongoDB giúp dữ liệu được lưu trữ an toàn trên Cloud (Atlas) và không bị mất khi khởi động lại server.

## 2. Chuẩn bị

1.  **Tài khoản MongoDB Atlas**: Đăng ký miễn phí tại [mongodb.com](https://www.mongodb.com/).
2.  **Tạo Cluster**: Tạo một database mới.
3.  **Lấy Connection String**:
    *   Vào nút **Connect** -> **Drivers**.
    *   Copy chuỗi kết nối, dạng: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
    *   Nhớ thay `<username>` và `<password>` bằng tài khoản database user của bạn.

## 3. Cấu hình Kết Nối

Hệ thống nhận diện biến môi trường `MONGODB_URI` để tự động chuyển sang chế độ MongoDB.

### Cách 1: Chạy trên Cloud (Render, Vercel, Heroku...)

Vào phần **Environment Variables** (Biến môi trường) của dự án trên Cloud và thêm:

*   **Key**: `MONGODB_URI`
*   **Value**: (Dán chuỗi kết nối MongoDB của bạn vào đây)

### Cách 2: Chạy Local (Trên máy tính)

Để chạy local mà không cần set biến môi trường mỗi lần, bạn nên cài thêm thư viện `dotenv`.

1.  Mở terminal tại thư mục dự án, chạy lệnh:
    ```bash
    npm install dotenv
    ```

2.  Thêm dòng sau vào đầu file `server.js` (dòng 1):
    ```javascript
    require('dotenv').config();
    ```

3.  Tạo file `.env` tại thư mục gốc và thêm nội dung:
    ```env
    MONGODB_URI=mongodb+srv://user:pass@cluster... (điền link của bạn)
    ```

## 4. Kiểm tra Kết Nối

Khi khởi động server (`npm start` hoặc `npm run dev`), hãy quan sát log trong terminal.

*   **Thành công**:
    ```
    [MongoDataManager] Connected to MongoDB Atlas successfully
    ```
*   **Thất bại** (sẽ dùng file local):
    ```
    [MongoDataManager] MongoDB connection error: ...
    ```
    hoặc
    ```
    [MongoDataManager] MONGODB_URI not found in environment variables.
    ```

## 5. Cấu trúc Dữ Liệu

Hệ thống sử dụng cơ chế "Single Document Store" để đơn giản hóa việc chuyển đổi:
*   Toàn bộ dữ liệu (users, medicines, schedules...) được lưu trong **một document duy nhất** trong collection `systemdatas`.
*   Key định danh: `main_system_data`.
*   Bạn không cần tạo bảng hay collection trước, hệ thống sẽ tự tạo khi chạy lần đầu.
