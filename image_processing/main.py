import os
import time
import cv2
import threading
import requests
import socketio
import numpy as np
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont
from flask import Flask, request, jsonify, Response
from dotenv import load_dotenv
from face_utils import FaceRecognizer

load_dotenv()

app = Flask(__name__)

SERVER_URL = os.getenv("SERVER_URL", "https://tuthuociot-minhthien.onrender.com")
CHECKIN_DURATION = int(os.getenv("CHECKIN_DURATION", 3600)) # Seconds
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", 0))

face_recognizer = FaceRecognizer(SERVER_URL)
# Load faces at startup
try:
    face_recognizer.load_known_faces()
except Exception as e:
    print(f"Error loading faces: {e}")

is_checking_in = False
checkin_thread = None
stop_checkin_event = threading.Event()

# Active Check-in Request (from Server)
active_checkin_request = None
active_checkin_lock = threading.Lock()

# Socket.IO Client
sio = socketio.Client()

def log_serial(message):
    """Logs a message with a timestamp to the console (serial output)."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [SERIAL] {message}")

@sio.event
def connect():
    log_serial("Connected to Web Server via Socket.IO")

@sio.event
def connect_error(data):
    log_serial(f"Socket connection failed: {data}")

@sio.event
def disconnect():
    log_serial("Disconnected from Web Server")

@sio.event
def triggerCheckin(data):
    """
    Received when it's time for a user to take medicine.
    data: { scheduleId, userId, userName, medicineName, scheduledTime, timestamp }
    """
    global active_checkin_request
    log_serial(f"Received Check-in Trigger: {data}")
    with active_checkin_lock:
        active_checkin_request = data
        # Optional: Set a timeout to clear this request if no one checks in after X hours?
        # For now, we keep it until replaced or fulfilled.
    start_checkin_process()

@sio.event
def syncFacesRequest(data):
    log_serial(f"Received sync request from Server: {data}")
    # Trigger face reload in a separate thread to not block socket
    threading.Thread(target=reload_faces_task).start()

def reload_faces_task():
    log_serial("Starting face sync task...")
    try:
        success = face_recognizer.sync_faces_from_server()
        if success:
            log_serial("Face sync completed successfully")
        else:
            log_serial("Face sync failed")
    except Exception as e:
        log_serial(f"Error during face sync: {e}")

def start_socket_client():
    while True:
        try:
            log_serial(f"Connecting to Socket.IO Server at {SERVER_URL}...")
            sio.connect(SERVER_URL)
            sio.wait()
        except Exception as e:
            log_serial(f"Socket connection error: {e}")
            log_serial("Retrying in 5 seconds...")
            time.sleep(5)

# Global camera variables
camera = None
global_frame = None
camera_lock = threading.Lock()

# Global cooldown dictionary
last_checkin_times = {}
CHECKIN_COOLDOWN = 60 # Seconds

def get_camera():
    global camera
    if camera is None:
        log_serial(f"Opening camera index {CAMERA_INDEX}...")
        camera = cv2.VideoCapture(CAMERA_INDEX)
        if not camera.isOpened():
            log_serial(f"Error: Could not open camera index {CAMERA_INDEX}")
    return camera

def release_camera():
    global camera
    if camera is not None:
        log_serial("Releasing camera...")
        camera.release()
        camera = None

def draw_faces_and_names(frame, face_locations, names):
    """
    Draws boxes and UTF-8 text on an OpenCV image using PIL.
    Optimized to convert to PIL only once per frame.
    """
    # Draw boxes first (OpenCV is fast)
    for (top, right, bottom, left), name in zip(face_locations, names):
        # Scale back up face locations since the frame we detected in was scaled to 1/4 size
        top *= 4
        right *= 4
        bottom *= 4
        left *= 4
        
        # Draw a box around the face
        cv2.rectangle(frame, (left, top), (right, bottom), (0, 0, 255), 2)
        # Draw a label with a name below the face
        cv2.rectangle(frame, (left, bottom - 35), (right, bottom), (0, 0, 255), cv2.FILLED)

    # If no faces, return early to save PIL conversion
    if not names:
        return frame

    try:
        pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_img)
        # Try to load a font that supports Vietnamese
        try:
            # Windows usually has arial.ttf
            font = ImageFont.truetype("arial.ttf", 20)
        except IOError:
            try:
                # Linux/Raspberry Pi might have DejaVuSans
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
            except IOError:
                font = ImageFont.load_default()
        
        for (top, right, bottom, left), name in zip(face_locations, names):
            # Scale coordinates for text
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4
            draw.text((left + 6, bottom - 29), name, font=font, fill=(255, 255, 255))
            
        return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        log_serial(f"Error drawing text: {e}")
        return frame

def generate_frames():
    global global_frame
    frame_count = 0
    while True:
        with camera_lock:
            if global_frame is not None:
                ret, buffer = cv2.imencode('.jpg', global_frame)
                if ret:
                    frame = buffer.tobytes()
                    frame_count += 1
                    # print(f"Yielding frame {frame_count}") # Reduced log noise
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                else:
                    log_serial("Failed to encode frame")
            else:
                # Create a default frame if no camera frame available
                default_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(default_frame, "Camera not ready...", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                ret, buffer = cv2.imencode('.jpg', default_frame)
                if ret:
                    frame = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                # print("No global_frame available, yielding default frame")
        time.sleep(0.04) # ~25 FPS for smoother streaming

def send_checkin_request(user_id, schedule_id=None, status=None):
    """Sends check-in request in a separate thread to avoid blocking."""
    global last_checkin_times, active_checkin_request
    
    current_time = time.time()
    last_time = last_checkin_times.get(user_id, 0)
    
    if current_time - last_time < CHECKIN_COOLDOWN:
        # print(f"Skipping check-in for user {user_id} (Cooldown active)")
        return

    payload = {"userId": user_id}
    if schedule_id:
        payload["scheduleId"] = schedule_id
    if status:
        payload["status"] = status

    log_serial(f"Sending check-in request: {payload}")

    try:
        response = requests.post(f"{SERVER_URL}/api/checkin/confirm", json=payload, timeout=2)
        
        # Update cooldown regardless of success to prevent spamming server with invalid requests
        last_checkin_times[user_id] = current_time

        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log_serial(f"Confirmed check-in for user {user_id}: {data.get('status')}")
                # Clear active request if successful
                with active_checkin_lock:
                    if active_checkin_request and str(active_checkin_request.get('userId')) == str(user_id):
                        active_checkin_request = None
            else:
                log_serial(f"Server rejected check-in for user {user_id}: {data.get('message')}")
        else:
             log_serial(f"Server error: {response.status_code} - {response.text}")

    except Exception as e:
        log_serial(f"Failed to notify server: {e}")

def camera_loop():
    global global_frame, is_checking_in, active_checkin_request
    log_serial("Starting camera loop...")
    cap = get_camera()
    
    if not cap.isOpened():
        log_serial("Error: Camera is not opened!")
        is_checking_in = False
        return
    
    frame_count = 0
    process_every_n_frames = 4 # Process 1 out of every 4 frames
    
    # Store last results to display during skipped frames
    last_detected_ids = []
    last_detected_names = []
    last_face_locations = []

    while is_checking_in and not stop_checkin_event.is_set():
        ret, frame = cap.read()
        if ret:
            frame_count += 1
            
            # Only run face recognition every N frames
            if frame_count % process_every_n_frames == 0:
                # Face recognition logic
                # Returns: ids, names, locations, confidences
                last_detected_ids, last_detected_names, last_face_locations, confidences = face_recognizer.recognize_face(frame)
                
                if last_face_locations:
                     log_serial(f"Faces detected: {len(last_face_locations)}. IDs: {last_detected_ids}, Names: {last_detected_names}")

                if last_detected_ids:
                    # Check against active schedule
                    with active_checkin_lock:
                        if active_checkin_request:
                            target_user_id = str(active_checkin_request.get('userId'))
                            match_found = False
                            
                            for i, user_id in enumerate(last_detected_ids):
                                if str(user_id) == target_user_id:
                                    match_found = True
                                    confidence = confidences[i]
                                    if confidence > 60: # User requirement: > 60% match
                                        try:
                                            # Calculate time difference
                                            scheduled_ts = active_checkin_request.get('timestamp') / 1000.0
                                            current_ts = time.time()
                                            
                                            diff_seconds = current_ts - scheduled_ts
                                            diff_hours = diff_seconds / 3600.0
                                            
                                            status = None
                                            if diff_hours < 2:
                                                status = "taken"
                                            elif 2 <= diff_hours <= 4:
                                                status = "late"
                                            else:
                                                status = "missed" # > 4 hours
                                            
                                            log_serial(f"Match found! User: {user_id}, Conf: {confidence:.1f}%, Diff: {diff_hours:.2f}h, Status: {status}")
                                            
                                            # Send to server
                                            threading.Thread(target=send_checkin_request, args=(user_id, active_checkin_request.get('scheduleId'), status)).start()
                                            
                                        except Exception as e:
                                            log_serial(f"Error calculating time/status: {e}")
                                    else:
                                        log_serial(f"Match found but confidence too low: {confidence:.1f}%")
                            
                            if not match_found:
                                log_serial(f"No match for target user {target_user_id}. Detected: {last_detected_ids}")

                        else:
                            # Fallback for non-scheduled checkins (optional, or keep existing behavior)
                            for user_id in last_detected_ids:
                                threading.Thread(target=send_checkin_request, args=(user_id,)).start()

            # Draw using the last known locations and names
            frame = draw_faces_and_names(frame, last_face_locations, last_detected_names)
            
            # Show video locally (X11/Display)
            cv2.imshow("Tu thuoc AIoT - Face Recognition", frame)
            cv2.waitKey(1)

            with camera_lock:
                global_frame = frame.copy()
                # print(f"Updated global_frame with frame {frame_count}") # Commented out to reduce log noise
                
        else:
            log_serial("Failed to grab frame from camera")
            time.sleep(1)
        
        # Removed time.sleep(0.05) to maximize FPS
        # time.sleep(0.01) # Optional: tiny sleep to prevent 100% CPU usage if needed, but usually CV2 waits for camera

    release_camera()
    cv2.destroyAllWindows()
    is_checking_in = False
    log_serial("Camera loop finished.")

@app.route('/')
def index():
    return """
    <html>
        <head>
            <title>AIoT Face Recognition Module</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #333; }
                .status { margin: 20px; padding: 10px; border: 1px solid #ddd; display: inline-block; }
                .btn { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>AIoT Face Recognition Module</h1>
            <div class="status">
                <p>Status: Running</p>
                <p>Camera Index: """ + str(CAMERA_INDEX) + """</p>
            </div>
            <br><br>
            <a href="/video_feed" class="btn">View Video Stream</a>
        </body>
    </html>
    """

@app.route('/test-camera')
def test_camera():
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if cap.isOpened():
        ret, frame = cap.read()
        cap.release()
        if ret:
            return "Camera test: SUCCESS - Frame captured"
        else:
            return "Camera test: FAILED - Cannot read frame"
    else:
        return f"Camera test: FAILED - Cannot open camera index {CAMERA_INDEX}"

@app.route('/video_feed')
def video_feed():
    # Auto-start camera if not running
    global is_checking_in, checkin_thread, stop_checkin_event
    if not is_checking_in:
        log_serial("Auto-starting camera for video feed...")
        stop_checkin_event.clear()
        is_checking_in = True
        checkin_thread = threading.Thread(target=camera_loop)
        checkin_thread.start()
        
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

def start_checkin_process():
    """Helper function to start the check-in camera loop."""
    global is_checking_in, checkin_thread, stop_checkin_event
    
    if is_checking_in:
        log_serial("Check-in already in progress.")
        return False
    
    log_serial("Starting check-in process...")
    stop_checkin_event.clear()
    is_checking_in = True
    checkin_thread = threading.Thread(target=camera_loop)
    checkin_thread.start()
    return True

@sio.event
def triggerCheckin(data):
    log_serial(f"Received triggerCheckin event from Server: {data}")
    start_checkin_process()

@app.route('/trigger-checkin', methods=['POST'])
def trigger_checkin():
    if start_checkin_process():
        return jsonify({"status": "started"}), 200
    else:
        return jsonify({"status": "already_running"}), 200

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
    # Start Socket.IO client in a background thread
    socket_thread = threading.Thread(target=start_socket_client)
    socket_thread.daemon = True
    socket_thread.start()

    # Initial sync
    face_recognizer.sync_faces_from_server()
    app.run(host='0.0.0.0', port=5000, threaded=True)
