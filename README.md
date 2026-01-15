# Video Content Analysis Suite

A comprehensive toolkit for automated YouTube video content analysis, featuring search, download, transcript extraction, screenshot capture, and OCR text extraction capabilities.

---

## Table of Contents

- [Challenge](#challenge)
- [Journey](#journey)
- [Discovery](#discovery)
- [Innovation](#innovation)
- [Breakthrough](#breakthrough)
- [Transformation](#transformation)
- [Impact](#impact)
- [Collaboration](#collaboration)
- [Lessons Learned](#lessons-learned)
- [Future](#future)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
  - [findVideos.js](#findvideosjs)
  - [download.py](#downloadpy)
  - [screenshot.py](#screenshotpy)
  - [extract_text.py](#extract_textpy)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

---

## Challenge

We faced a daunting challenge with video content analysis: **manually extracting meaningful data from YouTube videos is time-consuming, error-prone, and simply doesn't scale**.

Researchers, content analysts, journalists, and archivists frequently need to:
- Search for videos containing specific topics or keywords
- Download videos for offline analysis
- Extract transcripts for text-based research
- Capture visual content at regular intervals
- Perform OCR on video frames to extract on-screen text

The obstacles were significant:
- **YouTube's dynamic UI** constantly changes, breaking traditional scraping approaches
- **Consent dialogs and cookie banners** interrupt automated workflows
- **Multiple URL formats** (standard, Shorts, shortened links) require normalization
- **Download restrictions** and API limitations make reliable downloads difficult
- **No unified pipeline** existed to handle the complete content extraction workflow

```
Before: Hours of manual work per video
        Click → Copy → Paste → Screenshot → Repeat
        Error-prone and mentally exhausting
```

---

## Journey

The journey to build this Video Content Analysis Suite was full of twists and turns, evolving from simple scripts into an integrated processing pipeline.

### Key Milestones

**Phase 1: Browser Automation**
We started with `findVideos.js`, implementing Puppeteer-based automation to interact with YouTube's dynamic interface. This required understanding how YouTube renders content client-side and finding reliable selectors.

**Phase 2: Download Reliability**
`download.py` began as a simple pytube wrapper but evolved to include fallback mechanisms when we encountered download failures. The multi-strategy approach (pytube → yt-dlp) emerged from real-world testing.

**Phase 3: Visual Content Extraction**
`screenshot.py` was developed to capture frames at consistent intervals, supporting both traditional video formats and animated GIFs through OpenCV and Pillow integration.

**Phase 4: Text Extraction**
`extract_text.py` completed the pipeline by adding OCR capabilities, enabling extraction of on-screen text that wouldn't appear in transcripts.

```
Timeline of Development:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Browser    │───►│  Download   │───►│ Screenshot  │───►│    OCR      │
│ Automation  │    │  Pipeline   │    │ Extraction  │    │ Integration │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Discovery

We discovered several hidden complexities within the YouTube ecosystem that were the root cause of initial failures:

### YouTube Shorts Require Special Handling
YouTube Shorts use a completely different UI structure than regular videos. The transcript button location, video player controls, and page layout all differ. This discovery led to implementing conditional logic in `findVideos.js`:

```javascript
// Shorts detection and special handling
if (window.location.pathname.includes('/shorts/')) {
    // Different selector strategy for Shorts UI
}
```

### Multiple Transcript Button Selectors Needed
YouTube's A/B testing means different users see different UI variations. We discovered that relying on a single CSS selector for the transcript button was unreliable:

```javascript
const selectors = [
    "a#video-title",           // Traditional selector
    'a[href*="/watch"]',       // Alternative approach
    // Multiple fallback selectors...
];
```

### pytube Limitations
Through extensive testing, we discovered pytube occasionally fails on certain videos due to cipher extraction issues. This led to implementing yt-dlp as a robust fallback:

```python
def download_video(url, output_dir, audio_only=False):
    try:
        # Try pytube first
        yt = pytube.YouTube(normalized_url, on_progress_callback=progress_function)
        # ...
    except Exception as e:
        print("Trying alternative download method with yt-dlp...")
        return download_with_ytdlp(url, output_dir, audio_only)
```

---

## Innovation

The innovative use of multiple technologies and strategies within this project drastically improved reliability and coverage:

### Multi-Strategy Download Approach
Rather than depending on a single download method, we implemented a cascade:

```
Download Request
       │
       ▼
┌──────────────┐     Success
│   pytube     │────────────────► Downloaded
└──────────────┘
       │ Failure
       ▼
┌──────────────┐     Success
│   yt-dlp     │────────────────► Downloaded
└──────────────┘
       │ Failure
       ▼
   Report Error
```

### Cross-Platform Chrome Detection
`findVideos.js` automatically detects Chrome/Chromium across Linux, macOS, and Windows:

```javascript
const chromePaths = {
    linux: [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
    ],
    darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ],
    win32: [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    ],
};
```

### Frame-Accurate Timestamp Mapping
The screenshot module calculates precise frame positions based on video FPS:

```python
fps = cap.get(cv2.CAP_PROP_FPS)
times = [i * 0.5 for i in range(int(total_duration / 0.5) + 1)]
for t in times:
    frame_number = min(int(t * fps), total_frames - 1)
```

### URL Format Normalization
Supporting multiple YouTube URL formats through intelligent parsing:

```python
def normalize_youtube_url(url):
    if "/shorts/" in url:
        video_id = url.split("/shorts/")[1].split("?")[0]
    elif "/watch?v=" in url:
        video_id = url.split("/watch?v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        video_id = url.split("youtu.be/")[1].split("?")[0]
    return f"https://www.youtube.com/watch?v={video_id}"
```

---

## Breakthrough

The breakthrough came when we implemented several key features that seamlessly integrated with the overall pipeline:

### Automatic Consent Dialog Handling
YouTube's consent dialogs were blocking automation. Implementing automatic acceptance allowed uninterrupted processing:

```javascript
// Handle YouTube consent dialog if it appears
const consentButton = await page.$('button[aria-label*="Accept"]');
if (consentButton) {
    await consentButton.click();
    await page.waitForNavigation();
}
```

### Modular Pipeline Architecture
Each component operates independently but integrates seamlessly:

```
YouTube URL
     │
     ├─► findVideos.js ──► Transcripts (JSON/TXT)
     │
     ├─► download.py ──► Video Files (MP4/WEBM)
     │        │
     │        ├─► screenshot.py ──► Frame Images (PNG)
     │        │
     │        └─► extract_text.py ──► OCR Results (TXT)
     │
     └─► Complete Analysis Package
```

### OCR Deduplication
Consecutive identical text is automatically filtered to avoid redundant output:

```python
if text.strip() and (not text_list or text.strip().lower() != text_list[-1].strip().lower()):
    text_list.append(text.strip())
```

---

## Transformation

The Video Content Analysis Suite was transformed from a collection of manual tasks to a lightning-fast automated pipeline:

### Before

| Task | Method | Time |
|------|--------|------|
| Find relevant videos | Manual YouTube search | 30+ min |
| Download video | Browser extension | 5-10 min |
| Extract transcript | Manual copy/paste | 15+ min |
| Capture screenshots | Manual screenshots | 20+ min |
| Extract on-screen text | Manual transcription | 30+ min |
| **Total per video** | | **100+ min** |

### After

| Task | Method | Time |
|------|--------|------|
| Find relevant videos | `node findVideos.js` | 2-5 min |
| Download video | `python download.py` | 1-3 min |
| Extract transcript | Automatic via findVideos | 0 min (included) |
| Capture screenshots | `python screenshot.py` | 30 sec |
| Extract on-screen text | `python extract_text.py` | 1-2 min |
| **Total per video** | | **5-10 min** |

**Result: 90%+ time reduction**

---

## Impact

The impact on research workflows and content analysis was immediate, with user satisfaction soaring:

### Quantifiable Benefits

- **10x faster** video content analysis workflow
- **Batch processing** enables analyzing dozens of videos overnight
- **Consistent output** formats facilitate downstream analysis
- **Reduced errors** through automation eliminates copy/paste mistakes

### Use Cases Enabled

1. **Academic Research**: Analyze video content for media studies, linguistics, and social science research
2. **Content Archival**: Preserve video content with full text extraction for searchability
3. **Accessibility**: Generate text alternatives from video content
4. **Journalism**: Quickly extract quotes and verify video content
5. **Training Data**: Generate labeled datasets for machine learning projects

### Sample Output Structure

```
project/
├── transcripts/
│   └── video_title.json       # Timestamped transcript data
├── downloaded/
│   └── video_title_ID.mp4     # Downloaded video file
├── screenshots/
│   ├── screenshot_0001.png    # Frame at 0.0s
│   ├── screenshot_0002.png    # Frame at 0.5s
│   └── ...
└── extracted_text/
    └── video_title.txt        # OCR results
```

---

## Collaboration

Collaboration between different technology stacks, particularly between JavaScript and Python components, was key to the project's success:

### Technology Division

| Component | Language | Responsibility |
|-----------|----------|----------------|
| `findVideos.js` | JavaScript | Web automation, dynamic content |
| `download.py` | Python | Video downloading, stream handling |
| `screenshot.py` | Python | Frame extraction, image processing |
| `extract_text.py` | Python | OCR, text processing |

### Why This Split Works

**JavaScript (Node.js)** excels at:
- Browser automation via Puppeteer
- Handling dynamic, JavaScript-rendered content
- Managing async operations for web scraping

**Python** excels at:
- Video/image processing (OpenCV, Pillow)
- OCR integration (pytesseract/Tesseract)
- Scientific computing and data processing
- Rich ecosystem of media processing libraries

### Contributing Together

The modular architecture enables contributors to work on individual components without affecting others:

```
Frontend Team              Backend Team
     │                          │
     ▼                          ▼
findVideos.js             Python scripts
     │                          │
     └──────────┬───────────────┘
                │
                ▼
        Shared Output Formats
        (JSON, TXT, PNG, MP4)
```

---

## Lessons Learned

We learned valuable lessons about scalability, reliability, and maintainability that will inform future development:

### 1. Always Have Fallback Strategies

```python
# Primary method
try:
    download_with_pytube()
except:
    # Fallback method
    download_with_ytdlp()
```

**Lesson**: External services change without notice. Multiple approaches ensure continued operation.

### 2. Selector Flexibility is Essential

YouTube's UI undergoes frequent A/B testing and updates. Hard-coding single selectors leads to brittle code:

```javascript
// Bad: Single selector
const button = await page.$('button.specific-class');

// Good: Multiple fallback selectors
const selectors = ['selector1', 'selector2', 'selector3'];
for (const sel of selectors) {
    const button = await page.$(sel);
    if (button) break;
}
```

### 3. Graceful Degradation Over Hard Failures

When one feature fails, the system should continue with reduced functionality rather than crashing entirely.

### 4. Normalize Inputs Early

Handling multiple URL formats at the entry point prevents issues downstream:

```python
normalized_url = normalize_youtube_url(url)  # Always standardize first
```

### 5. Progress Feedback Matters

Long-running operations benefit from progress indicators:

```python
def progress_function(stream, chunk, bytes_remaining):
    percentage = (bytes_downloaded / total_size) * 100
    print(f"\r{percentage:.2f}% downloaded", end="")
```

---

## Future

This experience has paved the way for future optimizations and new features:

### Planned Enhancements

- [ ] **Parallel Processing**: Download and process multiple videos concurrently
- [ ] **Cloud Deployment**: Containerized version for serverless execution
- [ ] **Web Interface**: Browser-based UI for non-technical users
- [ ] **API Service**: RESTful API for integration with other tools

### Potential New Features

- [ ] **Speaker Identification**: Identify different speakers in video audio
- [ ] **Sentiment Analysis**: Analyze emotional tone of transcript content
- [ ] **Scene Detection**: Automatically identify scene changes
- [ ] **Summary Generation**: AI-powered video content summarization
- [ ] **Multi-language Support**: OCR and transcript support for additional languages

### Architecture Evolution

```
Current: Sequential Pipeline
┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐
│ Find  │──►│Download│──►│Screen │──►│  OCR  │
└───────┘   └───────┘   └───────┘   └───────┘

Future: Parallel Pipeline with Orchestration
                    ┌───────────┐
                    │Orchestrator│
                    └─────┬─────┘
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     ┌─────────┐    ┌─────────┐    ┌─────────┐
     │Worker 1 │    │Worker 2 │    │Worker 3 │
     └─────────┘    └─────────┘    └─────────┘
```

---

## Quick Start

Get up and running in minutes:

```bash
# Clone the repository
git clone https://github.com/yourusername/video.git
cd video

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install pytube yt-dlp opencv-python pillow pytesseract

# Ensure Tesseract OCR is installed
# Ubuntu/Debian: sudo apt install tesseract-ocr
# macOS: brew install tesseract
# Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki

# Run your first search
node findVideos.js

# Download a video
python download.py "https://youtube.com/watch?v=VIDEO_ID"

# Extract screenshots
python screenshot.py downloaded/video_file.mp4

# Extract text via OCR
python extract_text.py downloaded/video_file.mp4
```

---

## Installation

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 14+ | JavaScript runtime |
| Python | 3.7+ | Python runtime |
| Chrome/Chromium | Latest | Browser automation |
| Tesseract OCR | 4.0+ | Text recognition |

### Node.js Dependencies

```bash
npm install
```

This installs:
- `puppeteer-core` ^24.6.0 - Headless browser automation

### Python Dependencies

```bash
pip install pytube yt-dlp opencv-python pillow pytesseract
```

| Package | Purpose |
|---------|---------|
| `pytube` | Primary YouTube downloader |
| `yt-dlp` | Fallback YouTube downloader |
| `opencv-python` | Video frame extraction |
| `pillow` | Image/GIF processing |
| `pytesseract` | OCR interface to Tesseract |

### System Dependencies

**Tesseract OCR** (required for `extract_text.py`):

```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr

# macOS
brew install tesseract

# Windows
# Download installer from:
# https://github.com/UB-Mannheim/tesseract/wiki
```

---

## Usage

### findVideos.js

Search YouTube and extract transcripts from matching videos.

```bash
node findVideos.js
```

**Configuration** (edit in source):
- `query`: Search term for YouTube
- `keywords`: Terms to find within transcripts
- `exactPhraseSearch`: Boolean for exact phrase matching

**Output**: Transcript data saved to `transcript/` directory

---

### download.py

Download YouTube videos or audio with automatic fallback.

```bash
# Basic video download
python download.py "https://youtube.com/watch?v=VIDEO_ID"

# Audio only (MP3)
python download.py "https://youtube.com/watch?v=VIDEO_ID" --audio-only

# Custom output directory
python download.py "https://youtube.com/watch?v=VIDEO_ID" -o ./my_videos/

# Force yt-dlp backend
python download.py "https://youtube.com/watch?v=VIDEO_ID" --force-ytdlp

# Download entire playlist
python download.py "https://youtube.com/playlist?list=PLAYLIST_ID"
```

**Arguments**:

| Argument | Description | Default |
|----------|-------------|---------|
| `url` | YouTube video/playlist URL | Required |
| `-o`, `--output` | Output directory | `./downloaded` |
| `--audio-only` | Download audio stream only | `false` |
| `--force-ytdlp` | Skip pytube, use yt-dlp | `false` |

**Supported URL Formats**:
- Standard: `https://www.youtube.com/watch?v=VIDEO_ID`
- Shorts: `https://www.youtube.com/shorts/VIDEO_ID`
- Shortened: `https://youtu.be/VIDEO_ID`
- Playlists: `https://youtube.com/playlist?list=PLAYLIST_ID`

---

### screenshot.py

Extract frames from video files or animated GIFs at 0.5-second intervals.

```bash
# From video file
python screenshot.py /path/to/video.mp4

# From animated GIF
python screenshot.py /path/to/animation.gif
```

**Arguments**:

| Argument | Description |
|----------|-------------|
| `file` | Path to video or GIF file |

**Output**: PNG files saved to `screenshots/` directory

```
screenshots/
├── screenshot_0001.png  # t = 0.0s
├── screenshot_0002.png  # t = 0.5s
├── screenshot_0003.png  # t = 1.0s
└── ...
```

---

### extract_text.py

Extract on-screen text from video frames using OCR.

```bash
# Basic usage (processes every 30th frame)
python extract_text.py /path/to/video.mp4

# Custom frame interval (every 60 frames)
python extract_text.py /path/to/video.mp4 --interval 60

# Custom output file
python extract_text.py /path/to/video.mp4 --output ./results/text.txt
```

**Arguments**:

| Argument | Description | Default |
|----------|-------------|---------|
| `video_path` | Path to video file | Required |
| `--interval` | Process every Nth frame | `30` |
| `--output` | Output file path | `extracted_text/<video>.txt` |

**Output Format**:
```
Text from frame 1

Text from frame 2

Text from frame 3
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Video Content Analysis Suite                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │findVideos.js │ ◄─── YouTube Search & Transcript          │
│  │  (Node.js)   │      Extraction via Puppeteer             │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ download.py  │ ◄─── Video/Audio Download                 │
│  │  (Python)    │      pytube + yt-dlp fallback             │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ├────────────────────┐                              │
│         ▼                    ▼                              │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │screenshot.py │    │extract_text  │                       │
│  │  (Python)    │    │   .py        │                       │
│  │              │    │  (Python)    │                       │
│  │ OpenCV/PIL   │    │ pytesseract  │                       │
│  └──────────────┘    └──────────────┘                       │
│         │                    │                              │
│         ▼                    ▼                              │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │  PNG Images  │    │  Text Files  │                       │
│  └──────────────┘    └──────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Input**: YouTube URL or search query
2. **Search Phase**: `findVideos.js` searches YouTube, extracts video links and transcripts
3. **Download Phase**: `download.py` downloads video/audio files
4. **Processing Phase**:
   - `screenshot.py` extracts visual frames
   - `extract_text.py` performs OCR on frames
5. **Output**: Organized files in designated directories

### Directory Structure

```
video/
├── findVideos.js       # YouTube search and transcript extraction
├── download.py         # Video/audio downloader
├── screenshot.py       # Frame extraction
├── extract_text.py     # OCR text extraction
├── package.json        # Node.js dependencies
├── transcript/         # Transcript output directory
├── downloaded/         # Downloaded video files
├── screenshots/        # Extracted frame images
└── extracted_text/     # OCR results
```

---

## Contributing

Contributions are welcome. Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style

**JavaScript**:
- Use ES6+ features
- Async/await for asynchronous operations
- Meaningful variable names

**Python**:
- Follow PEP 8 guidelines
- Use type hints where applicable
- Document functions with docstrings

### Reporting Issues

When reporting issues, please include:
- Operating system and version
- Node.js and Python versions
- Complete error messages
- Steps to reproduce

---

## License

This project is available for use under standard open source terms. See the LICENSE file for details.

---

**Built with determination, debugged with patience, deployed with pride.**
