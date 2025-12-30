import cv2
import os
from dotenv import load_dotenv
from face_utils import FaceRecognizer

# Load environment variables
load_dotenv()

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:3000")
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", 0))

def main():
    print("Initializing Face Recognizer...")
    # Initialize recognizer (server_url is needed for sync, but we can skip sync for local test if images exist)
    recognizer = FaceRecognizer(SERVER_URL)
    
    # Load faces from local 'known_faces' directory
    recognizer.load_known_faces()
    
    print(f"Opening camera {CAMERA_INDEX}...")
    cap = cv2.VideoCapture(CAMERA_INDEX)
    
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    print("Camera started. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame")
            break

        # Recognize faces
        # Note: recognize_face returns (detected_ids, face_locations)
        # We need to modify or use the internal logic to get names for display, 
        # but recognize_face only returns IDs. 
        # Let's use the internal data of recognizer to find names.
        
        detected_ids, face_locations = recognizer.recognize_face(frame)
        
        # Draw results
        # face_locations are from the resized frame (0.25 scale), so we need to scale up by 4
        for (top, right, bottom, left), user_id in zip(face_locations, detected_ids):
            # Scale back up face locations since the frame we detected in was scaled to 1/4 size
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4

            # Draw a box around the face
            cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)

            # Draw a label with a name below the face
            # Find name corresponding to ID (a bit inefficient but fine for test)
            name = "Unknown"
            if user_id in recognizer.known_face_ids:
                index = recognizer.known_face_ids.index(user_id)
                name = recognizer.known_face_names[index]

            cv2.rectangle(frame, (left, bottom - 35), (right, bottom), (0, 255, 0), cv2.FILLED)
            font = cv2.FONT_HERSHEY_DUPLEX
            cv2.putText(frame, f"{name} ({user_id})", (left + 6, bottom - 6), font, 0.6, (255, 255, 255), 1)

        # Display the resulting image
        cv2.imshow('Video', frame)

        # Hit 'q' on the keyboard to quit!
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Release handle to the webcam
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
