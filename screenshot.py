import bisect
import os
import sys

import cv2
from PIL import Image


def handle_video(file_path, output_dir):
    """Extract screenshots from a video file every 0.5 seconds using OpenCV."""
    # Open the video file
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        print("Error: Could not open video file.")
        return

    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    total_duration = total_frames / fps

    # Generate time points at 0.5-second intervals
    times = [i * 0.5 for i in range(int(total_duration / 0.5) + 1) if i * 0.5 <= total_duration]

    # Capture and save screenshots
    counter = 1
    for t in times:
        # Calculate the frame number for time t
        frame_number = min(int(t * fps), total_frames - 1)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        if ret:
            # Save the frame as a PNG image
            output_path = os.path.join(output_dir, f"screenshot_{counter:04d}.png")
            cv2.imwrite(output_path, frame)
            counter += 1
        else:
            print(f"Error: Could not read frame at t={t} seconds.")

    # Release the video capture object
    cap.release()

def handle_gif(file_path, output_dir):
    """Extract screenshots from a GIF file every 0.5 seconds using Pillow."""
    # Open the GIF file
    image = Image.open(file_path)
    n_frames = image.n_frames

    # Collect frame durations (in seconds)
    durations = []
    for i in range(n_frames):
        image.seek(i)
        durations.append(image.info['duration'] / 1000.0)  # Convert ms to seconds

    # Compute cumulative times
    cum_times = [0]
    for d in durations:
        cum_times.append(cum_times[-1] + d)
    total_duration = cum_times[-1]

    # Generate time points at 0.5-second intervals
    times = [i * 0.5 for i in range(int(total_duration / 0.5) + 1) if i * 0.5 <= total_duration]

    # Capture and save screenshots
    counter = 1
    for t in times:
        # Find the frame index for time t
        idx = bisect.bisect_right(cum_times, t)
        frame_idx = min(idx - 1, n_frames - 1)
        image.seek(frame_idx)
        # Save the current frame as a PNG image
        output_path = os.path.join(output_dir, f"screenshot_{counter:04d}.png")
        image.save(output_path)
        counter += 1

def main():
    """Main function to process the input file and dispatch to the appropriate handler."""
    # Check command-line argument
    if len(sys.argv) != 2:
        print("Usage: python script.py <video_or_gif_file>")
        sys.exit(1)

    file_path = sys.argv[1]

    # Set up output directory
    output_dir = "screenshots"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Determine file type and process accordingly
    extension = os.path.splitext(file_path)[1].lower()
    if extension == '.gif':
        handle_gif(file_path, output_dir)
    else:
        handle_video(file_path, output_dir)

if __name__ == "__main__":
    main()
