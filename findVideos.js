const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

// Common Chrome/Chromium paths by platform
const chromePaths = {
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

// Find the first existing Chrome path
function findChromePath() {
  const platform = process.platform;
  const paths = chromePaths[platform] || [];

  for (const browserPath of paths) {
    try {
      if (fs.existsSync(browserPath)) {
        console.log(`Found browser at: ${browserPath}`);
        return browserPath;
      }
    } catch (error) {
      // Continue to the next path
    }
  }

  return null;
}

// Helper function to convert YouTube timestamp to seconds
function timestampToSeconds(timestamp) {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    // Format: HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // Format: MM:SS
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// Helper function to format seconds back to timestamp
function secondsToTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  } else {
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
}

// Helper function to estimate where in a segment a keyword appears
function estimateKeywordPosition(text, keyword) {
  const keywordLower = keyword.toLowerCase();
  const textLower = text.toLowerCase();

  // Find the keyword position
  const keywordIndex = textLower.indexOf(keywordLower);
  if (keywordIndex === -1) return 0; // Keyword not found, use start of segment

  // Calculate position as percentage of text length
  const position = keywordIndex / textLower.length;
  return position;
}

async function findVideosWithKeywords(
  query,
  keywords,
  exactPhraseSearch = false
) {
  // Try to find Chrome/Chromium on the system
  const executablePath = findChromePath();

  if (!executablePath) {
    console.error("ERROR: Could not find Chrome or Chromium on your system.");
    console.error(
      "Please install Chrome or provide the path manually in the script."
    );
    console.error(
      "Alternatively, install the full puppeteer package: npm install puppeteer"
    );
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set a longer default timeout
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(30000);

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"
    );

    // Navigate to YouTube search results
    console.log(`Searching for: ${query}`);
    await page.goto(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`,
      {
        waitUntil: "networkidle2", // Less strict waiting condition
      }
    );

    // Extract video URLs with scrolling to load more results
    console.log("Extracting video links (scrolling to load more results)...");

    // Function to scroll and collect video links
    const videoLinks = await page.evaluate(async () => {
      // Helper function to wait
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // Multiple selectors to try, in order of preference
      const selectors = [
        "a#video-title", // Traditional selector
        "a.ytd-video-renderer", // Another possible selector
        "a.yt-simple-endpoint", // Generic endpoint links
        "ytd-video-renderer a", // Video renderer links
        "ytd-compact-video-renderer a", // Compact video renderer links
        "a[href*='/watch?v=']", // Any link with watch URL pattern
      ];

      // Function to get all video elements using multiple selectors
      const getAllVideoElements = () => {
        let elements = [];
        for (const selector of selectors) {
          const found = Array.from(document.querySelectorAll(selector));
          // Only take elements that have href attributes and look like YouTube watch URLs
          const validElements = found.filter(
            (el) =>
              el.href &&
              (el.href.includes("/watch?v=") || el.href.includes("/shorts/"))
          );
          if (validElements.length > 0) {
            elements = validElements;
            console.log(
              `Found ${elements.length} videos using selector: ${selector}`
            );
            break;
          }
        }
        return elements;
      };

      // Initial video elements
      let videoElements = getAllVideoElements();
      let previousLength = 0;
      let scrollAttempts = 0;
      let consecutiveNoChangeCount = 0;
      const maxScrollAttempts = 20; // Increased from 10 to 20
      const maxConsecutiveNoChanges = 3; // Stop after 3 scrolls with no new videos

      // Scroll down until we have 100 videos or can't load more
      while (
        videoElements.length < 100 &&
        scrollAttempts < maxScrollAttempts &&
        consecutiveNoChangeCount < maxConsecutiveNoChanges
      ) {
        previousLength = videoElements.length;

        // More thorough scrolling - scroll in chunks
        const viewportHeight = window.innerHeight;
        const scrollStep = viewportHeight * 0.8;
        const currentPos = window.scrollY;

        // Scroll down in steps rather than jumping to the bottom
        window.scrollTo(0, currentPos + scrollStep);

        // Wait for initial content to load
        await wait(1000);

        // Then jump to bottom to trigger more loading
        window.scrollTo(0, document.body.scrollHeight);

        // Wait longer for content to load - YouTube might need more time
        await wait(2500);

        // Get video elements again
        videoElements = getAllVideoElements();

        // Check if we got new videos
        if (videoElements.length === previousLength) {
          consecutiveNoChangeCount++;
          console.log(
            `No new videos found after scroll. Attempt ${consecutiveNoChangeCount}/${maxConsecutiveNoChanges}`
          );
        } else {
          consecutiveNoChangeCount = 0; // Reset the counter if we found new videos
          console.log(`Scrolled, found ${videoElements.length} videos so far`);
        }

        scrollAttempts++;
      }

      // Log the reason for stopping
      if (videoElements.length >= 100) {
        console.log("Found 100 or more videos, stopping scrolling");
      } else if (scrollAttempts >= maxScrollAttempts) {
        console.log("Reached maximum scroll attempts, stopping");
      } else if (consecutiveNoChangeCount >= maxConsecutiveNoChanges) {
        console.log("No new videos found after multiple scrolls, stopping");
      }

      // Make sure we don't have duplicate links
      const uniqueUrls = new Set();
      const uniqueLinks = [];

      videoElements.forEach((a) => {
        if (a.href && !uniqueUrls.has(a.href)) {
          uniqueUrls.add(a.href);
          uniqueLinks.push(a.href);
        }
      });

      console.log(`Found ${uniqueLinks.length} unique video links`);

      // Extract URLs from elements (up to 100)
      return uniqueLinks.slice(0, 100);
    });

    console.log(`Found ${videoLinks.length} videos to process`);

    // Create results storage
    const transcriptResults = [];

    for (const videoUrl of videoLinks) {
      try {
        console.log(`Processing: ${videoUrl}`);

        // Extract video ID for use in results
        const videoId =
          new URL(videoUrl).searchParams.get("v") || videoUrl.split("/").pop();

        // Navigate to the video page
        await page.goto(videoUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        // Handle consent dialog if present using evaluate
        const acceptButtonExists = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const acceptButton = buttons.find(
            (button) =>
              button.textContent.includes("Accept all") ||
              button.textContent.includes("I agree")
          );
          if (acceptButton) {
            acceptButton.click();
            return true;
          }
          return false;
        });

        if (acceptButtonExists) {
          console.log(`Accepting consent dialog for ${videoUrl}`);
          // Use setTimeout instead of waitForTimeout
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // First, check if transcript button is directly available on the page
        console.log("Checking if transcript button is directly available...");
        const directTranscriptAvailable = await page.evaluate(() => {
          // Look for direct transcript button
          const transcriptButtons = Array.from(
            document.querySelectorAll(
              "button, ytd-button-renderer, yt-formatted-string, span, div"
            )
          ).filter(
            (el) =>
              el.textContent &&
              (el.textContent.includes("transcript") ||
                el.textContent.includes("Transcript")) &&
              el.offsetParent !== null // Ensure element is visible
          );

          if (transcriptButtons.length > 0) {
            transcriptButtons[0].click();
            return true;
          }

          return false;
        });

        if (directTranscriptAvailable) {
          console.log("Found and clicked direct transcript button");
          // Wait for transcript to appear
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          // Try different approaches to find and click the "More actions" button
          console.log('Looking for "More actions" button...');

          // Check if we're on a shorts page, which has different UI
          const isShorts = videoUrl.includes("/shorts/");

          // For shorts, try special handling
          if (isShorts) {
            console.log("Detected YouTube Shorts URL, using special handling");

            const shortsMenuClicked = await page.evaluate(() => {
              // For shorts, look for the three dots menu button
              const menuButtons = Array.from(
                document.querySelectorAll(
                  'button.yt-spec-button-shape-next, button.ytp-button, button[aria-label*="More"]'
                )
              );

              for (const button of menuButtons) {
                if (
                  button.querySelector("svg") ||
                  button.querySelector("yt-icon")
                ) {
                  button.click();
                  return true;
                }
              }

              return false;
            });

            if (!shortsMenuClicked) {
              console.log(
                `Could not find menu button for Shorts video: ${videoUrl}`
              );
              continue;
            }
          } else {
            // Regular videos
            const moreActionsClicked = await page.evaluate(() => {
              // Try multiple selectors for the "More actions" button
              const selectors = [
                'button[aria-label="More actions"]',
                'button[aria-label="More"]',
                "ytd-menu-renderer button",
                'button.ytp-button[aria-expanded="false"]',
                "button.ytp-settings-button",
                // New selectors for 2025 YouTube UI
                "button.yt-spec-button-shape-next",
                "ytd-watch-metadata button.yt-spec-button-shape-next--tonal",
                "ytd-menu-renderer ytd-button-renderer",
              ];

              // First try known selectors
              for (const selector of selectors) {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                  // Check if this is likely the more actions button
                  if (
                    (button.querySelector("yt-icon") ||
                      button.querySelector("svg")) &&
                    (button.getAttribute("aria-label")?.includes("More") ||
                      button.textContent?.includes("More") ||
                      button.getAttribute("title")?.includes("More"))
                  ) {
                    button.click();
                    return true;
                  }
                }
              }

              // Try backup approach - look for any button with three dots icon
              const allButtons = document.querySelectorAll("button");
              for (const button of allButtons) {
                // If it has an icon and is visible
                if (
                  (button.querySelector("yt-icon") ||
                    button.querySelector("svg")) &&
                  button.offsetParent !== null
                ) {
                  button.click();
                  return true;
                }
              }

              return false;
            });

            if (!moreActionsClicked) {
              console.log(
                `Could not find "More actions" button for ${videoUrl}`
              );

              // One last attempt - look for any visible button
              const anyButtonClicked = await page.evaluate(() => {
                const allButtons = Array.from(
                  document.querySelectorAll("button")
                );
                const visibleButtons = allButtons.filter(
                  (btn) => btn.offsetParent !== null
                );

                // Skip very small buttons (might be playback controls)
                const potentialMenuButtons = visibleButtons.filter((btn) => {
                  const rect = btn.getBoundingClientRect();
                  return rect.width > 20 && rect.height > 20;
                });

                if (potentialMenuButtons.length > 0) {
                  // Click a button that might bring up a menu
                  potentialMenuButtons[potentialMenuButtons.length - 1].click();
                  return true;
                }

                return false;
              });

              if (!anyButtonClicked) {
                console.log("Could not find any buttons to click");
                continue;
              }
            }
          }

          // Wait a moment for menu to appear
          console.log("Waiting for menu to appear...");
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        // Look for transcript option with improved detection
        console.log("Looking for transcript option...");

        // Try multiple approaches to find and click the transcript button
        const transcriptClicked = await page.evaluate(() => {
          // First check if transcript panel is already open
          if (
            document.querySelector(
              "ytd-transcript-renderer, ytd-transcript-search-panel-renderer"
            )
          ) {
            console.log("Transcript panel already appears to be open");
            return true;
          }

          // Approach 1: Menu service items (standard way)
          const menuItems = Array.from(
            document.querySelectorAll("ytd-menu-service-item-renderer")
          );
          for (const item of menuItems) {
            if (
              item.textContent.includes("Show transcript") ||
              item.textContent.includes("Open transcript")
            ) {
              console.log("Found transcript option in menu items");
              item.click();
              return true;
            }
          }

          // Approach 2: Direct buttons or links
          const transcriptButtons = Array.from(
            document.querySelectorAll(
              "button, ytd-button-renderer, a, yt-formatted-string"
            )
          );
          for (const button of transcriptButtons) {
            if (
              (button.textContent &&
                (button.textContent.includes("transcript") ||
                  button.textContent.includes("Transcript"))) ||
              button.getAttribute("aria-label")?.includes("transcript")
            ) {
              console.log("Found transcript button element");
              button.click();
              return true;
            }
          }

          // Approach 3: Look for the "..." menu in the bottom panel
          const dotButtons = Array.from(
            document.querySelectorAll(
              'button[aria-label="More actions"], button.ytp-button'
            )
          );
          if (dotButtons.length > 0) {
            // Click the first "More actions" button found in bottom panel
            dotButtons[0].click();

            // Wait a moment for menu to appear
            return "clicked-more";
          }

          return false;
        });

        // Handle the special case where we clicked "More actions" and need to find transcript
        if (transcriptClicked === "clicked-more") {
          // Wait for menu to appear
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Now look for transcript option in the newly opened menu
          const transcriptFound = await page.evaluate(() => {
            // Look in any popup menu that might have appeared
            const menuItems = Array.from(
              document.querySelectorAll(
                "ytd-menu-popup-renderer div, ytd-menu-popup-renderer span, ytd-menu-popup-renderer button"
              )
            );
            for (const item of menuItems) {
              if (
                item.textContent.includes("transcript") ||
                item.textContent.includes("Transcript")
              ) {
                item.click();
                return true;
              }
            }
            return false;
          });

          if (transcriptFound) {
            console.log("Found transcript option in secondary menu");
          } else {
            console.log("Could not find transcript option in secondary menu");
            console.log("Trying one more approach - direct panel opening");

            // Try one more approach - direct engagement panel access
            const panelOpened = await page.evaluate(() => {
              // Try to find and click on the transcript button in engagement panel
              const engagementButtons = Array.from(
                document.querySelectorAll(
                  'button[aria-label*="transcript"], button[data-panel-id*="transcript"]'
                )
              );

              if (engagementButtons.length > 0) {
                engagementButtons[0].click();
                return true;
              }
              return false;
            });

            if (!panelOpened) {
              console.log("No transcript option found for this video");
              continue;
            }
          }
        } else if (!transcriptClicked) {
          console.log("No transcript option found for this video");
          continue;
        }

        // Wait for transcript panel to load
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Select auto-generated transcript if multiple options exist
        const autoTranscriptSelected = await page.evaluate(() => {
          // Check if there's a transcript selection dropdown
          const transcriptSelectors = [
            "paper-dropdown-menu",
            "tp-yt-paper-dropdown-menu",
            "ytd-dropdown-menu",
            "select",
            "div[role='listbox']",
            "ytd-menu-popup-renderer",
          ];

          let transcriptDropdown = null;
          for (const selector of transcriptSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              // Look for dropdowns that contain language options
              if (
                el.textContent.includes("English") ||
                el.textContent.includes("transcript") ||
                el.textContent.includes("Transcript") ||
                el.textContent.toLowerCase().includes("auto")
              ) {
                transcriptDropdown = el;
                break;
              }
            }
            if (transcriptDropdown) break;
          }

          if (transcriptDropdown) {
            console.log("Found transcript selection dropdown");

            // Click to open the dropdown
            transcriptDropdown.click();

            // Wait briefly for dropdown to open
            return "dropdown-opened";
          }

          return "no-dropdown-found";
        });

        // If dropdown was opened, try to select auto-generated option
        if (autoTranscriptSelected === "dropdown-opened") {
          // Wait for dropdown menu to appear
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Try to select auto-generated option
          const optionSelected = await page.evaluate(() => {
            // Look for auto-generated options in various formats
            const autoGenOptions = [
              "auto-generated",
              "Auto-generated",
              "English (auto-generated)",
              "english (auto-generated)",
              "auto",
            ];

            // Try to find and click on auto-generated transcript option
            const menuItems = document.querySelectorAll(
              "tp-yt-paper-item, paper-item, ytd-menu-service-item-renderer, option, div[role='option']"
            );

            for (const item of menuItems) {
              const itemText = item.textContent.trim().toLowerCase();

              // Check if this menu item matches any auto-generated option pattern
              if (
                autoGenOptions.some((opt) =>
                  itemText.includes(opt.toLowerCase())
                )
              ) {
                // Click on this auto-generated option
                item.click();
                return `selected-${itemText}`;
              }
            }

            // If no auto-generated option found, take the first English option
            for (const item of menuItems) {
              const itemText = item.textContent.trim().toLowerCase();
              if (itemText.includes("english")) {
                item.click();
                return `selected-english-${itemText}`;
              }
            }

            // If still nothing found, just click the first option
            if (menuItems.length > 0) {
              menuItems[0].click();
              return `selected-first-${menuItems[0].textContent.trim()}`;
            }

            return "no-option-selected";
          });

          console.log(`Transcript option selection: ${optionSelected}`);

          // Wait for transcript to load after selection
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        // Wait longer for transcript panel to appear
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Add debug info
        console.log("Attempting to find transcript content with timestamps...");

        // Try to extract transcript segments with timestamps
        const transcriptData = await page.evaluate(() => {
          // Log what elements we can find for debugging
          const debug = {};

          // Store the transcript segments with timestamps
          let segments = [];

          // Try multiple selectors to find transcript segments
          const segmentSelectors = [
            "ytd-transcript-segment-renderer", // Modern YouTube
            ".ytd-transcript-segment-renderer", // Container class
            ".cue-group", // Classic format
            ".transcript-segment", // Another format
          ];

          // Check which elements we can find
          segmentSelectors.forEach((selector) => {
            debug[selector] = document.querySelectorAll(selector).length;
          });

          // Try each selector to find transcript segments
          for (const selector of segmentSelectors) {
            const elements = document.querySelectorAll(selector);

            if (elements.length > 0) {
              // Try to extract timestamp and text from each segment
              segments = Array.from(elements).map((segment) => {
                // Different possible selectors for timestamps and text
                const timestampSelectors = [
                  ".segment-timestamp",
                  ".timestamp",
                  '[class*="timestamp"]',
                  'div[class*="time"]',
                ];

                const textSelectors = [
                  ".segment-text",
                  ".cue-text",
                  ".text",
                  '[class*="text"]',
                ];

                // Find timestamp element
                let timestampEl = null;
                for (const tsSelector of timestampSelectors) {
                  const el = segment.querySelector(tsSelector);
                  if (el) {
                    timestampEl = el;
                    break;
                  }
                }

                // Find text element
                let textEl = null;
                for (const txtSelector of textSelectors) {
                  const el = segment.querySelector(txtSelector);
                  if (el) {
                    textEl = el;
                    break;
                  }
                }

                // Extract timestamp and text
                const timestamp = timestampEl
                  ? timestampEl.textContent.trim()
                  : "";
                const text = textEl ? textEl.textContent.trim() : "";

                // If both elements aren't found but the segment has text content,
                // try to parse it differently (some formats have timestamp and text directly in the segment)
                if ((!timestamp || !text) && segment.textContent) {
                  const content = segment.textContent.trim();
                  // Try to split by common patterns
                  const match = content.match(/^(\d+:\d+(?::\d+)?)\s*(.+)$/);

                  if (match) {
                    return {
                      timestamp: match[1],
                      text: match[2],
                    };
                  }
                }

                return { timestamp, text };
              });

              // Filter out any segments without both timestamp and text
              segments = segments.filter((s) => s.timestamp && s.text);

              // If we found valid segments, break the loop
              if (segments.length > 0) {
                break;
              }
            }
          }

          // If we couldn't find segments with the above methods, try a more generic approach
          if (segments.length === 0) {
            // Look for any elements that might contain timestamps and text
            const allElements = document.querySelectorAll("*");

            // Temporary storage for potential segments
            const potentialSegments = [];

            // Pattern to identify a timestamp
            const timestampPattern = /^\d+:\d+(?::\d+)?$/;

            // Scan all elements for timestamp patterns
            for (const el of allElements) {
              const text = el.textContent.trim();

              // If element contains just a timestamp
              if (timestampPattern.test(text) && text.length <= 8) {
                // Look for the next sibling that might contain text
                let textElement = el.nextElementSibling;

                if (textElement && textElement.textContent.trim().length > 0) {
                  potentialSegments.push({
                    timestamp: text,
                    text: textElement.textContent.trim(),
                  });
                }
              }
            }

            // Use these segments if found
            if (potentialSegments.length > 0) {
              segments = potentialSegments;
            }
          }

          // Return the final results
          return {
            segments: segments,
            debug: debug,
            segmentCount: segments.length,
          };
        });

        // Log detailed debugging info
        console.log(
          "Transcript debug info:",
          JSON.stringify(transcriptData.debug, null, 2)
        );
        console.log(
          `Found ${transcriptData.segmentCount} transcript segments with timestamps`
        );

        if (!transcriptData.segments || transcriptData.segments.length === 0) {
          console.log(
            `Could not extract transcript segments with timestamps for ${videoUrl}`
          );
          continue;
        }

        // Get video title for results
        const videoTitle = await page.evaluate(() => {
          const titleElement =
            document.querySelector("h1 yt-formatted-string") ||
            document.querySelector("h1") ||
            document.querySelector(".title");
          return titleElement
            ? titleElement.textContent.trim()
            : "Unknown Title";
        });

        // Now check for keywords in the transcript segments
        const keywordMatches = [];

        for (let i = 0; i < transcriptData.segments.length; i++) {
          const segment = transcriptData.segments[i];
          const segmentText = segment.text.toLowerCase();
          const segmentTimestamp = segment.timestamp;
          const startTimeSeconds = timestampToSeconds(segmentTimestamp);

          // Get next segment timestamp for duration calculation
          let endTimeSeconds;
          if (i < transcriptData.segments.length - 1) {
            endTimeSeconds = timestampToSeconds(
              transcriptData.segments[i + 1].timestamp
            );
          } else {
            // If it's the last segment, estimate the end time
            const avgSegmentDuration = 5; // Assume average segment is about 5 seconds
            endTimeSeconds = startTimeSeconds + avgSegmentDuration;
          }

          const segmentDuration = endTimeSeconds - startTimeSeconds;

          // Check for each keyword
          for (const keyword of keywords) {
            const keywordLower = keyword.toLowerCase();

            // Decide on search method based on exactPhraseSearch flag
            let keywordFound = false;

            if (exactPhraseSearch) {
              // Exact phrase matching
              keywordFound = segmentText.includes(keywordLower);
            } else {
              // Word boundary matching for individual words
              const keywordRegex = new RegExp(
                `(^|[^a-zA-Z0-9])${keywordLower.replace(
                  /[-\/\\^$*+?.()|[\]{}]/g,
                  "\\$&"
                )}([^a-zA-Z0-9]|$)`,
                "i"
              );
              keywordFound = keywordRegex.test(segmentText);
            }

            if (keywordFound) {
              // Calculate the more precise timestamp by estimating where in the segment the keyword appears
              const keywordPosition = estimateKeywordPosition(
                segment.text,
                keyword
              );
              const preciseTimeSeconds = Math.round(
                startTimeSeconds + keywordPosition * segmentDuration
              );
              const preciseTimestamp = secondsToTimestamp(preciseTimeSeconds);

              keywordMatches.push({
                keyword: keyword,
                originalTimestamp: segmentTimestamp,
                preciseTimestamp: preciseTimestamp,
                preciseTimeSeconds: preciseTimeSeconds,
                text: segment.text,
                url: `${videoUrl}&t=${preciseTimeSeconds}`,
              });
            }
          }
        }

        // Filter out duplicates after collecting all matches
        const uniqueMatches = [];
        const seenCombinations = new Map();

        for (const match of keywordMatches) {
          // Create a unique key for this timestamp + text combination
          const key = `${match.preciseTimeSeconds}:${match.text}`;

          // If we haven't seen this combination before, add it
          if (!seenCombinations.has(key)) {
            seenCombinations.set(key, true);
            uniqueMatches.push(match);
          }
        }

        if (uniqueMatches.length > 0) {
          console.log(
            `MATCH FOUND! Found ${uniqueMatches.length} keyword mentions in ${videoUrl}`
          );

          // Add to our results
          transcriptResults.push({
            videoId: videoId,
            videoTitle: videoTitle,
            url: videoUrl,
            matches: uniqueMatches,
          });

          // Print each match
          uniqueMatches.forEach((match, index) => {
            console.log(
              `Match ${index + 1}: "${match.keyword}" at ${
                match.preciseTimestamp
              } (originally ${match.originalTimestamp}) - "${match.text}"`
            );
            console.log(`Direct link: ${match.url}`);
          });
        } else {
          console.log(`No matching keywords found in ${videoUrl}`);
        }
      } catch (error) {
        console.error(`Error processing ${videoUrl}:`, error.message);
      }
    }

    // Save all results to a file in transcript folder
    if (transcriptResults.length > 0) {
      try {
        // Create transcript folder if it doesn't exist
        const transcriptFolder = "transcript";
        if (!fs.existsSync(transcriptFolder)) {
          fs.mkdirSync(transcriptFolder);
        }

        // Create a filename based on search query and keywords
        const sanitizedQuery = query.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const sanitizedKeywords = keywords
          .map((k) => k.replace(/[^a-z0-9]/gi, "_").toLowerCase())
          .join("_");
        const filename = `${sanitizedQuery}_${sanitizedKeywords}.json`;
        const filePath = path.join(transcriptFolder, filename);

        fs.writeFileSync(
          filePath,
          JSON.stringify(transcriptResults, null, 2),
          "utf8"
        );
        console.log(`Results saved to ${filePath}`);
      } catch (error) {
        console.error("Error saving results:", error.message);
      }
    } else {
      console.log("No keyword matches found in any videos");
    }
  } catch (error) {
    console.error("Fatal error:", error);
  } finally {
    await browser.close();
    console.log("Browser closed");
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let searchQuery = "ai agent";
let searchKeywords = ["ai agent"];
let exactPhraseSearch = false;

// Process command line arguments
if (args.length >= 1) {
  searchQuery = args[0];
}

if (args.length >= 2) {
  searchKeywords = args[1].split(",").map((k) => k.trim());
}

if (args.length >= 3 && args[2].toLowerCase() === "exact") {
  exactPhraseSearch = true;
}

console.log(
  `Searching for "${searchQuery}" with ${
    exactPhraseSearch ? "exact phrases" : "keywords"
  }: ${searchKeywords.join(", ")}`
);
findVideosWithKeywords(searchQuery, searchKeywords, exactPhraseSearch);
