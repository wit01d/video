import argparse
import os
import subprocess

import pytube
import yt_dlp


def sanitize_filename(title):
    """
    Sanitize the video title to create a valid filename by keeping only
    alphanumeric characters, spaces, underscores, and hyphens.
    """
    return "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).rstrip()


def progress_function(stream, chunk, bytes_remaining):
    """
    Display download progress as a percentage.
    """
    total_size = stream.filesize
    bytes_downloaded = total_size - bytes_remaining
    percentage = (bytes_downloaded / total_size) * 100
    print(f"\r{percentage:.2f}% downloaded", end="")


def normalize_youtube_url(url):
    """
    Convert various YouTube URL formats to the standard watch?v= format.
    Supports:
    - Shorts URLs (e.g., https://www.youtube.com/shorts/LB4PIqXzv48)
    - Standard URLs (e.g., https://www.youtube.com/watch?v=LB4PIqXzv48)
    - Shortened URLs (e.g., https://youtu.be/LB4PIqXzv48)
    """
    if "/shorts/" in url:
        # Extract video ID from Shorts URL
        video_id = url.split("/shorts/")[1].split("?")[0]
    elif "/watch?v=" in url:
        # Extract video ID from standard URL
        video_id = url.split("/watch?v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        # Extract video ID from shortened youtu.be URL
        video_id = url.split("youtu.be/")[1].split("?")[0]
    else:
        raise ValueError("Unsupported YouTube URL format")
    # Return standard URL
    return f"https://www.youtube.com/watch?v={video_id}"


def download_with_ytdlp(url, output_dir, audio_only=False):
    """
    Download a YouTube video using yt-dlp as an alternative method.

    Args:
        url (str): The YouTube video URL.
        output_dir (str): Directory where the file will be saved.
        audio_only (bool): If True, download only the audio stream.
    """
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)

        # Build the yt-dlp command
        cmd = [
            "yt-dlp",
            url,
            "-o", os.path.join(output_dir, "%(title)s_%(id)s.%(ext)s")
        ]

        if audio_only:
            cmd.extend(["-x", "--audio-format", "mp3"])

        print(f"\nAttempting download with yt-dlp: {url}")
        # Run the command
        subprocess.run(cmd, check=True)
        print("\nDownload completed with yt-dlp!")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"\nFailed to download with yt-dlp: {e}")
        return False


def download_video(url, output_dir, audio_only=False):
    """
    Download a single YouTube video or audio stream.
    Tries pytube first, falls back to yt-dlp if available.

    Args:
        url (str): The YouTube video URL.
        output_dir (str): Directory where the file will be saved.
        audio_only (bool): If True, download only the audio stream.
    """
    try:
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)

        # Normalize the URL to standard format
        normalized_url = normalize_youtube_url(url)

        # Create a YouTube object with progress callback
        yt = pytube.YouTube(normalized_url, on_progress_callback=progress_function)

        # Select stream based on audio-only option
        if audio_only:
            stream = yt.streams.filter(only_audio=True).first()
        else:
            stream = yt.streams.get_highest_resolution()

        # Create a unique filename using sanitized title and video ID
        extension = os.path.splitext(stream.default_filename)[1]
        filename = f"{sanitize_filename(yt.title)}_{yt.video_id}{extension}"
        output_path = os.path.join(output_dir, filename)

        print(f"\nDownloading {yt.title} to {output_path}")
        stream.download(output_path=output_dir, filename=filename)
        print("\nDownload completed!")
        return True
    except Exception as e:
        print(f"\nPytube download failed for {url}: {e}")
        print("Trying alternative download method with yt-dlp...")
        return download_with_ytdlp(url, output_dir, audio_only)


def main():
    """
    Main function to parse arguments and initiate downloads.
    """
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description="Download YouTube videos or playlists."
    )
    parser.add_argument("url", help="The YouTube video or playlist URL")
    parser.add_argument("--output", "-o", help="Output directory", default="./downloaded")
    parser.add_argument("--audio-only", action="store_true", help="Download audio only")
    parser.add_argument("--force-ytdlp", action="store_true",
                        help="Force using yt-dlp instead of pytube")
    args = parser.parse_args()

    # Ensure output directory exists
    os.makedirs(args.output, exist_ok=True)

    # Check if we should force yt-dlp
    if args.force_ytdlp:
        if "list=" in args.url:
            try:
                # For playlists, yt-dlp can handle them directly
                download_with_ytdlp(args.url, args.output, args.audio_only)
            except Exception as e:
                print(f"Failed to process playlist with yt-dlp: {e}")
        else:
            download_with_ytdlp(args.url, args.output, args.audio_only)
    else:
        # Check if the URL is a playlist
        if "list=" in args.url:
            try:
                playlist = pytube.Playlist(args.url)
                print(f"Downloading playlist: {playlist.title}")
                for video_url in playlist.video_urls:
                    download_video(video_url, args.output, args.audio_only)
            except Exception as e:
                print(f"Failed to process playlist with pytube: {e}")
                print("Trying playlist download with yt-dlp...")
                download_with_ytdlp(args.url, args.output, args.audio_only)
        else:
            download_video(args.url, args.output, args.audio_only)


if __name__ == "__main__":
    main()
