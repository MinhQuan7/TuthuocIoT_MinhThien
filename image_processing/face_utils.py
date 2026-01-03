import face_recognition
import cv2
import os
import shutil
import numpy as np
import requests
import json
from datetime import datetime

def log_serial(message):
    """Logs a message with a timestamp to the console (serial output)."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [SERIAL] {message}")

class FaceRecognizer:
    def __init__(self, server_url, storage_path="known_faces"):
        self.server_url = server_url
        self.storage_path = storage_path
        self.known_face_encodings = []
        self.known_face_names = []
        self.known_face_ids = []
        
        if not os.path.exists(self.storage_path):
            os.makedirs(self.storage_path)

    def load_known_faces(self):
        """Loads faces from local storage and encodes them."""
        log_serial("Loading known faces...")
        self.known_face_encodings = []
        self.known_face_names = []
        self.known_face_ids = []

        for user_dir in os.listdir(self.storage_path):
            user_path = os.path.join(self.storage_path, user_dir)
            if os.path.isdir(user_path):
                # user_dir format expected: "UserID_Name"
                try:
                    user_id, user_name = user_dir.split("_", 1)
                except ValueError:
                    log_serial(f"Skipping invalid directory name: {user_dir}")
                    continue

                for filename in os.listdir(user_path):
                    if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                        image_path = os.path.join(user_path, filename)
                        try:
                            image = face_recognition.load_image_file(image_path)
                            encodings = face_recognition.face_encodings(image)
                            if encodings:
                                self.known_face_encodings.append(encodings[0])
                                self.known_face_names.append(user_name)
                                self.known_face_ids.append(user_id)
                        except Exception as e:
                            log_serial(f"Error processing {filename}: {e}")
        
        log_serial(f"Loaded {len(self.known_face_encodings)} face encodings.")

    def sync_faces_from_server(self):
        """Downloads user images from the server and removes deleted users."""
        log_serial("Syncing faces from server...")
        try:
            response = requests.get(f"{self.server_url}/api/users/images")
            if response.status_code == 200:
                users = response.json()
                valid_user_dirs = set()

                for user in users:
                    user_id = str(user['id'])
                    user_name = user['name']
                    avatars = user.get('avatars', [])
                    
                    # Create user directory
                    user_dir_name = f"{user_id}_{user_name}"
                    valid_user_dirs.add(user_dir_name)
                    
                    user_path = os.path.join(self.storage_path, user_dir_name)
                    if not os.path.exists(user_path):
                        os.makedirs(user_path)
                    
                    # Download images
                    for i, avatar_url in enumerate(avatars):
                        # Handle both relative paths and full URLs (Google Drive)
                        if avatar_url.startswith('http'):
                            full_url = avatar_url
                        else:
                            full_url = f"{self.server_url}{avatar_url}"
                            
                        filename = f"face_{i}.jpg"
                        file_path = os.path.join(user_path, filename)
                        
                        if not os.path.exists(file_path):
                            log_serial(f"Downloading {full_url}...")
                            try:
                                resp = requests.get(full_url)
                                if resp.status_code == 200 and 'image' in resp.headers.get('Content-Type', ''):
                                    with open(file_path, 'wb') as handler:
                                        handler.write(resp.content)
                                else:
                                    log_serial(f"Skipping {full_url}: Status {resp.status_code}, Type {resp.headers.get('Content-Type')}")
                            except Exception as e:
                                log_serial(f"Failed to download {full_url}: {e}")
                
                # Cleanup deleted users
                if os.path.exists(self.storage_path):
                    for item in os.listdir(self.storage_path):
                        item_path = os.path.join(self.storage_path, item)
                        if os.path.isdir(item_path) and item not in valid_user_dirs:
                            log_serial(f"Removing deleted user data: {item}")
                            try:
                                shutil.rmtree(item_path)
                            except Exception as e:
                                log_serial(f"Error removing {item}: {e}")
                
                # Reload faces after sync
                self.load_known_faces()
                return True
            else:
                log_serial(f"Failed to fetch users: {response.status_code}")
                return False
        except Exception as e:
            log_serial(f"Sync error: {e}")
            return False

    def recognize_face(self, frame):
        """
        Detects and recognizes faces in a frame.
        Returns a list of detected user IDs, names, and face locations.
        """
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        detected_ids = []
        detected_names = []
        confidences = []

        for face_encoding in face_encodings:
            # matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding, tolerance=0.5)
            name = "Unknown"
            user_id = None
            confidence = 0.0

            face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
            if len(face_distances) > 0:
                best_match_index = np.argmin(face_distances)
                # Calculate confidence: 0.0 distance is 100% match. 0.6 is typical threshold.
                # Let's map 0.6 distance to 0% confidence and 0.0 to 100%.
                # Formula: max(0, (0.6 - distance) / 0.6) * 100
                # Or simpler: (1 - distance) if we assume distance is 0-1.
                # The user wants > 60% match.
                # If we use standard threshold 0.6, then any match is "good".
                # Let's return the raw distance or a calculated percentage.
                
                distance = face_distances[best_match_index]
                if distance < 0.6: # Standard threshold
                    name = self.known_face_names[best_match_index]
                    user_id = self.known_face_ids[best_match_index]
                    # Convert distance to percentage (approximate)
                    # 0.0 -> 100%, 0.6 -> 40% (if linear).
                    # Let's use: (1 - distance) * 100.
                    # If distance is 0.4, confidence is 60%.
                    confidence = (1.0 - distance) * 100
                    
                    detected_ids.append(user_id)
                    detected_names.append(name)
                    confidences.append(confidence)
                else:
                    detected_names.append("Unknown")
                    confidences.append(0.0)
            else:
                detected_names.append("Unknown")
                confidences.append(0.0)

        return detected_ids, detected_names, face_locations, confidences
