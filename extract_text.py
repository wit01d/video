import argparse
import os

import cv2
import pytesseract


def extract_text_from_video(video_path, interval=30):
    """
    Extract text from a video by processing frames at specified intervals using OCR.

    Args:
        video_path (str): Path to the video file.
        interval (int): Number of frames to skip between processing (default is 30).

    Returns:
        list: List of extracted text strings.
    """
    # Open the video file
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")

    text_list = []  # To store extracted text
    frame_count = 0  # To track frame number

    # Process video frames
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:  # Exit if no more frames
            break

        # Process frame at specified interval
        if frame_count % interval == 0:
            # Extract text using OCR
            text = pytesseract.image_to_string(frame)
            # Add text if not empty and different from the last added text
            if text.strip() and (not text_list or text.strip().lower() != text_list[-1].strip().lower()):
                text_list.append(text.strip())

        frame_count += 1

    # Release the video capture object
    cap.release()
    return text_list


def save_text_to_file(text_list, output_file):
    """
    Save extracted text to a file.

    Args:
        text_list (list): List of text strings to save.
        output_file (str): Path to the output file.
    """
    directory = os.path.dirname(output_file)
    if directory and not os.path.exists(directory):
        os.makedirs(directory)

    with open(output_file, 'w', encoding='utf-8') as f:
        for text in text_list:
            f.write(f"{text}\n\n")  # Add double newlines between text blocks for readability


if __name__ == '__main__':
    # Set up command-line argument parser
    parser = argparse.ArgumentParser(description='Extract text from video')
    parser.add_argument('video_path', type=str, help='Path to the video file')
    parser.add_argument('--interval', type=int, default=30, help='Frame interval for processing')
    parser.add_argument('--output', type=str, default=None,
                        help='Path to output file (default: saves to extracted_text/[video_name].txt)')
    args = parser.parse_args()

    # Create default output filename based on input video name if not specified
    if args.output is None:
        # Create extracted_text directory if it doesn't exist
        output_dir = "extracted_text"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            print(f"Created directory: {output_dir}")

        # Extract base name without extension and add .txt
        base_name = os.path.splitext(os.path.basename(args.video_path))[0]
        args.output = os.path.join(output_dir, f"{base_name}.txt")

    # Extract text
    print(f"Extracting text from {args.video_path}...")
    texts = extract_text_from_video(args.video_path, args.interval)

    # Save to file
    save_text_to_file(texts, args.output)
    print(f"Extracted {len(texts)} text segments and saved to {args.output}")

    # Also print to console if there aren't too many segments
    if len(texts) <= 10:
        print("\nExtracted text:")
        for text in texts:
            print(f"---\n{text}\n---")
    else:
        print(f"\nFirst 3 extracted segments:")
        for text in texts[:3]:
            print(f"---\n{text}\n---")
        print(f"\n... and {len(texts) - 3} more segments (see {args.output} for all content)")
