import face_recognition
import cv2
import os
import numpy as np
import requests
import json

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
        print("Loading known faces...")
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
                    print(f"Skipping invalid directory name: {user_dir}")
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
                            print(f"Error processing {filename}: {e}")
        
        print(f"Loaded {len(self.known_face_encodings)} face encodings.")

    def sync_faces_from_server(self):
        """Downloads user images from the server."""
        print("Syncing faces from server...")
        try:
            response = requests.get(f"{self.server_url}/api/users/images")
            if response.status_code == 200:
                users = response.json()
                for user in users:
                    user_id = str(user['id'])
                    user_name = user['name']
                    avatars = user.get('avatars', [])
                    
                    # Create user directory
                    user_dir_name = f"{user_id}_{user_name}"
                    user_path = os.path.join(self.storage_path, user_dir_name)
                    if not os.path.exists(user_path):
                        os.makedirs(user_path)
                    
                    # Download images
                    for i, avatar_url in enumerate(avatars):
                        # Assuming avatar_url is relative path like /assets/...
                        full_url = f"{self.server_url}{avatar_url}"
                        filename = f"face_{i}.jpg"
                        file_path = os.path.join(user_path, filename)
                        
                        if not os.path.exists(file_path):
                            print(f"Downloading {full_url}...")
                            img_data = requests.get(full_url).content
                            with open(file_path, 'wb') as handler:
                                handler.write(img_data)
                
                # Reload faces after sync
                self.load_known_faces()
                return True
            else:
                print(f"Failed to fetch users: {response.status_code}")
                return False
        except Exception as e:
            print(f"Sync error: {e}")
            return False

    def recognize_face(self, frame):
        """
        Detects and recognizes faces in a frame.
        Returns a list of detected user IDs.
        """
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        detected_ids = []

        for face_encoding in face_encodings:
            matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding, tolerance=0.5)
            name = "Unknown"
            user_id = None

            face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
            if len(face_distances) > 0:
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    name = self.known_face_names[best_match_index]
                    user_id = self.known_face_ids[best_match_index]
                    detected_ids.append(user_id)

        return detected_ids, face_locations
