#!/bin/bash

# Script setup tự động chạy service cho Raspberry Pi
# Cách dùng:
# 1. Cấp quyền thực thi: chmod +x setup_service.sh
# 2. Chạy script: ./setup_service.sh

# Lấy đường dẫn tuyệt đối của thư mục hiện tại
WORK_DIR=$(pwd)
VENV_PYTHON="$WORK_DIR/venv/bin/python"
SERVICE_NAME="tuthuoc.service"

echo "--- Cấu hình tự động chạy cho Tu Thuoc AIoT ---"
echo "Thư mục làm việc: $WORK_DIR"

# Kiểm tra xem venv đã có chưa
if [ ! -f "$VENV_PYTHON" ]; then
    echo "Lỗi: Không tìm thấy môi trường ảo (venv) tại $VENV_PYTHON"
    echo "Vui lòng tạo venv trước: python3 -m venv venv"
    echo "Và cài đặt thư viện: source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Tạo file service
echo "Đang tạo file $SERVICE_NAME..."

cat <<EOF > $SERVICE_NAME
[Unit]
Description=Tu Thuoc AIoT Face Recognition Service
After=network.target video.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORK_DIR
ExecStart=$VENV_PYTHON main.py
Restart=always
RestartSec=5
# Các biến môi trường để hỗ trợ hiển thị GUI (cv2.imshow) nếu cần
Environment=PYTHONUNBUFFERED=1
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/$USER/.Xauthority

[Install]
WantedBy=multi-user.target
EOF

echo "Đã tạo file service."

# Di chuyển vào thư mục hệ thống và kích hoạt
echo "Đang cài đặt vào systemd..."
sudo mv $SERVICE_NAME /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo "------------------------------------------------"
echo "Cài đặt hoàn tất!"
echo "Service đã được kích hoạt và sẽ tự chạy khi khởi động."
echo "Để kiểm tra trạng thái: sudo systemctl status $SERVICE_NAME"
echo "Để xem log: journalctl -u $SERVICE_NAME -f"
echo "------------------------------------------------"
