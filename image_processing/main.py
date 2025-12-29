import os
import time
import cv2
import threading
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from face_utils import FaceRecognizer

load_dotenv()

app = Flask(__name__)

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:3000")
CHECKIN_DURATION = int(os.getenv("CHECKIN_DURATION", 3600)) # Seconds
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", 0))

face_recognizer = FaceRecognizer(SERVER_URL)
is_checking_in = False
checkin_thread = None
stop_checkin_event = threading.Event()

def checkin_process(duration):
    global is_checking_in
    print(f"Starting check-in process for {duration} seconds...")
    
    cap = cv2.VideoCapture(CAMERA_INDEX)
    start_time = time.time()
    
    while time.time() - start_time < duration and not stop_checkin_event.is_set():
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame")
            time.sleep(1)
            continue
            
        detected_ids, _ = face_recognizer.recognize_face(frame)
        
        if detected_ids:
            print(f"Detected users: {detected_ids}")
            # Notify server
            for user_id in detected_ids:
                try:
                    # Debounce or check if already confirmed recently could be added here
                    requests.post(f"{SERVER_URL}/api/checkin/confirm", json={"userId": user_id})
                    print(f"Confirmed check-in for user {user_id}")
                    
                    # Optional: Stop check-in after successful detection?
                    # For now, we keep running to detect others or re-confirm
                except Exception as e:
                    print(f"Failed to notify server: {e}")
        
        time.sleep(0.5) # Limit frame rate processing

    cap.release()
    is_checking_in = False
    print("Check-in process finished.")

@app.route('/trigger-checkin', methods=['POST'])
def trigger_checkin():
    global is_checking_in, checkin_thread, stop_checkin_event
    
    if is_checking_in:
        return jsonify({"status": "already_running"}), 200
    
    stop_checkin_event.clear()
    is_checking_in = True
    checkin_thread = threading.Thread(target=checkin_process, args=(CHECKIN_DURATION,))
    checkin_thread.start()
    
    return jsonify({"status": "started"}), 200

@app.route('/stop-checkin', methods=['POST'])
def stop_checkin():
    global stop_checkin_event
    stop_checkin_event.set()
    return jsonify({"status": "stopping"}), 200

@app.route('/sync-faces', methods=['POST'])
def sync_faces():
    success = face_recognizer.sync_faces_from_server()
    return jsonify({"success": success}), 200

if __name__ == '__main__':
    # Initial sync
    face_recognizer.sync_faces_from_server()
    app.run(host='0.0.0.0', port=5000)
