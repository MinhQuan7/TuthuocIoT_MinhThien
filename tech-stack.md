# Tech Stack Chi Tiết - Dự Án Giao Diện Web Tủ Thuốc AIoT

## Tổng Quan Dự Án

Dự án này là một ứng dụng web dashboard cho hệ thống tủ thuốc thông minh (AIoT - Artificial Intelligence of Things). Ứng dụng cho phép quản lý người dùng, lịch uống thuốc, giám sát trạng thái tủ thuốc, và hiển thị thống kê tuân thủ.

## Cấu Trúc Dự Án

```
giaodienweb/
├── package.json          # Cấu hình dự án Node.js và dependencies
├── server.js             # Server backend Node.js với Express và Socket.IO
├── public/               # Thư mục chứa frontend
│   ├── index.html        # Giao diện chính với navigation và các page
│   ├── client.js         # JavaScript phía client xử lý Socket.IO và UI
│   └── style.css         # CSS với thiết kế glassmorphism và responsive
└── node_modules/         # Thư mục chứa các package dependencies được cài đặt
```

## Backend (Server-Side)

### Runtime Environment

- **Node.js**: JavaScript runtime environment
- **CommonJS Modules**: Hệ thống module (type: "commonjs" trong package.json)

### Web Framework & Libraries

- **Express.js (v5.1.0)**: Web framework cho Node.js

  - Tạo HTTP server
  - Serve static files từ thư mục `public`
  - Xử lý routing cơ bản

- **Socket.IO (v4.8.1)**: Thư viện real-time communication
  - WebSocket-based real-time bidirectional communication
  - Xử lý các event: kết nối, gửi nhắc nhở, lưu lịch, quản lý người dùng
  - Giả lập dữ liệu IoT và cập nhật real-time

### Chức Năng Backend

- **Server Setup**: Khởi tạo HTTP server và Socket.IO server trên port 3000
- **Static File Serving**: Serve các file HTML, CSS, JS từ thư mục public
- **Real-time Data Simulation**:
  - Giả lập trạng thái tủ thuốc (nhiệt độ, độ ẩm)
  - Timeline events (đã uống/bỏ lỡ thuốc)
  - Alerts (cảnh báo hết thuốc)
  - Statistics updates (tuân thủ người dùng)
- **Socket Event Handling**:
  - `sendReminder`: Gửi lệnh nhắc nhở
  - `saveNewSchedule`: Lưu lịch uống thuốc mới
  - `saveNewUser`: Thêm người dùng mới
  - `deleteUser`: Xóa người dùng
- **Data Storage**: Sử dụng in-memory data structures (không có database)

## Frontend (Client-Side)

### HTML Structure

- **Semantic HTML5**: Sử dụng các thẻ semantic như `<nav>`, `<main>`, `<header>`, `<section>`
- **Single Page Application (SPA)**: Navigation giữa các "page" thông qua JavaScript (không reload)
- **Responsive Design**: Sử dụng CSS Grid và Flexbox

### CSS Styling

- **Glassmorphism Design**: Hiệu ứng kính mờ với backdrop-filter
- **Dark Theme**: Gradient background động với animation
- **CSS Variables**: Sử dụng CSS custom properties cho theme colors
- **Responsive Layout**: Media queries cho mobile và tablet
- **Custom Scrollbars**: Tùy chỉnh thanh cuộn

### JavaScript (Client-Side)

- **Vanilla JavaScript**: Không sử dụng framework, pure JS
- **Socket.IO Client**: Kết nối real-time với server
- **DOM Manipulation**: Thao tác DOM để cập nhật UI động
- **Event Handling**: Xử lý form submissions, button clicks, navigation
- **Data Rendering Functions**:
  - `renderScheduleList()`: Hiển thị danh sách lịch uống thuốc
  - `renderUserList()`: Hiển thị danh sách người dùng
  - `renderStatisticsChart()`: Vẽ biểu đồ thống kê với Chart.js

### Third-Party Libraries

- **Chart.js**: Thư viện vẽ biểu đồ JavaScript
  - Tạo biểu đồ bar chart cho thống kê tuân thủ 7 ngày
  - Responsive và customizable

## Dependencies & Package Management

### npm (Node Package Manager)

- **package.json**: Quản lý dependencies và scripts
- **node_modules**: Thư mục chứa các package đã cài đặt
- **Scripts**: Chỉ có script "test" mặc định (chưa implement)

### Core Dependencies

- **express**: ^5.1.0 - Web framework
- **socket.io**: ^4.8.1 - Real-time communication

## Kiến Trúc Ứng Dụng

### Architecture Pattern

- **Client-Server Architecture**: Frontend (browser) ↔ Backend (Node.js)
- **Real-time Communication**: WebSocket via Socket.IO
- **Event-Driven**: Cả client và server đều sử dụng event-based communication

### Data Flow

1. Client kết nối Socket.IO với server
2. Server gửi dữ liệu ban đầu (`initialData`)
3. Client render UI với dữ liệu nhận được
4. Server định kỳ gửi updates (IoT status, alerts, stats)
5. Client gửi actions (reminders, new schedules, user management)
6. Server xử lý và broadcast updates cho tất cả clients

### State Management

- **Server**: In-memory data objects (heThongData)
- **Client**: Local data store (localDataStore) đồng bộ với server qua Socket.IO

## Chức Năng Chính

### 1. Dashboard (Tổng Quan)

- Hiển thị trạng thái tủ thuốc (online/offline, nhiệt độ, độ ẩm)
- Timeline lịch sử uống thuốc
- Danh sách cảnh báo
- Thống kê tuân thủ người dùng (progress bars)

### 2. Lịch Cài Đặt

- Thêm lịch uống thuốc mới (người dùng, ngày, buổi, tên thuốc)
- Hiển thị danh sách lịch sắp tới
- Sắp xếp theo ngày và buổi

### 3. Thống Kê

- Biểu đồ bar chart tuân thủ 7 ngày qua
- So sánh giữa các người dùng

### 4. Quản Lý Người Dùng

- Thêm người dùng mới với avatar
- Xóa người dùng
- Hiển thị danh sách người dùng hiện tại

## Development & Deployment

### Development

- **Local Development**: Chạy `node server.js` hoặc `npm start` (cần thêm script)
- **Hot Reload**: Không có (cần thêm nodemon)
- **Browser**: Tự động mở tại http://localhost:3000

### Production Considerations

- **Database**: Hiện tại dùng in-memory, cần tích hợp database thực (MongoDB, PostgreSQL)
- **Authentication**: Chưa có, cần thêm cho security
- **HTTPS**: Cần cấu hình SSL cho production
- **Scalability**: Single server, cần load balancer cho multiple instances

## Công Nghệ Sử Dụng Tóm Tắt

| Layer           | Technology        | Version | Purpose                      |
| --------------- | ----------------- | ------- | ---------------------------- |
| Runtime         | Node.js           | -       | JavaScript execution         |
| Backend         | Express.js        | 5.1.0   | Web server framework         |
| Real-time       | Socket.IO         | 4.8.1   | WebSocket communication      |
| Frontend        | HTML5             | -       | Structure                    |
| Styling         | CSS3              | -       | Presentation (Glassmorphism) |
| Scripting       | JavaScript (ES6+) | -       | Client-side logic            |
| Charts          | Chart.js          | -       | Data visualization           |
| Package Manager | npm               | -       | Dependency management        |

## Điểm Mạnh & Điểm Cần Cải Thiện

### Điểm Mạnh

- Real-time updates với Socket.IO
- UI đẹp với glassmorphism design
- Responsive design
- Modular code structure

### Điểm Cần Cải Thiện

- Thêm database persistence
- Implement authentication/authorization
- Add error handling và validation
- Unit tests và integration tests
- Build process (webpack, babel)
- Environment configuration
- Logging system</content>
  <parameter name="filePath">f:\PersonalProject_Money\DATN\Tuthuoc_AIoT_ThienMTA\GIAODIENWEB\GIAODIENWEB\tech-stack.md
