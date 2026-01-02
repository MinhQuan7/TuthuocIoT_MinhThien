#!/bin/bash

# Dừng script nếu có lỗi
set -e

echo "=== Bắt đầu cài đặt môi trường cho Image Processing trên Raspberry Pi 5 ==="

# 1. Cập nhật hệ thống và cài đặt các thư viện hệ thống cần thiết
echo "[1/5] Cập nhật hệ thống và cài đặt dependencies..."
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    libx11-dev \
    libopenblas-dev \
    liblapack-dev \
    libgtk-3-dev \
    libboost-python-dev \
    python3-dev \
    python3-venv \
    python3-pip

# 2. Tạo môi trường ảo (Virtual Environment) nếu chưa có
echo "[2/5] Thiết lập môi trường ảo (venv)..."
if [ -d "venv" ] && [ ! -f "venv/bin/activate" ]; then
    echo "Phát hiện venv lỗi. Đang xóa để tạo lại..."
    rm -rf venv
fi

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Đã tạo venv mới."
else
    echo "venv đã tồn tại."
fi

# Kích hoạt môi trường ảo
source venv/bin/activate

# 3. Cập nhật pip
echo "[3/5] Cập nhật pip..."
pip install --upgrade pip setuptools wheel

# 4. Cài đặt các thư viện Python
# Lưu ý: dlib sẽ mất thời gian để compile (khoảng 10-20 phút trên Pi)
echo "[4/5] Đang cài đặt các thư viện Python từ requirements.txt..."
echo "Lưu ý: Quá trình cài đặt dlib có thể mất 10-20 phút. Vui lòng kiên nhẫn."

# Cài đặt từng gói quan trọng trước để dễ debug
echo "Installing numpy..."
pip install numpy

echo "Installing dlib (Compiling from source)..."
pip install dlib

echo "Installing opencv-python..."
pip install opencv-python

echo "Installing face_recognition..."
pip install face_recognition

echo "Installing remaining requirements..."
pip install -r requirements.txt

echo "=== Cài đặt hoàn tất! ==="
echo "Để chạy chương trình, hãy sử dụng lệnh:"
echo "source venv/bin/activate"
echo "python main.py"
