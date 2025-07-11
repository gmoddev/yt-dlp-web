
// Not_Lowest
// aidengaming.com

const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

//const { EnsureDependencies, YtDlpPath, FfmpegExe } = require("./update.js");

const app = express();
const PORT = 3000;
const DOWNLOAD_DIR = path.join(__dirname, "downloads");
const FFMPEG_PATH = "./"; 

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/yt-dlp-help", (req, res) => {
  exec(`"${__dirname}/yt-dlp.exe" --help`, (err, stdout) => {
    if (err) return res.status(500).send("Failed to fetch help text.");
    res.type("text").send(stdout);
  });
});

app.post("/download", async (req, res) => {
  const videoUrl = req.body.url;
  const format = req.body.format === "mp4" ? "mp4" : "mp3";

  if (!videoUrl) return res.status(400).send("No URL provided");

  const titleCmd = `"${__dirname}/yt-dlp.exe" --print \"%(title)s\" "${videoUrl}"`;
  exec(titleCmd, (err, stdout) => {
    if (err || !stdout) return res.status(500).send("Failed to fetch video title.");

    const rawTitle = stdout.trim();
    const videoTitle = rawTitle.replace(/[<>:"/\\|?*]+/g, "");
    const outputExt = format;

    const safeFlags = [];
    if (req.body.writeThumbnail === "true") safeFlags.push("--write-thumbnail");
    if (req.body.writeInfoJson === "true") safeFlags.push("--write-info-json");
    if (req.body.writeDescription === "true") safeFlags.push("--write-description");
    if (req.body.embedMetadata === "true") safeFlags.push("--embed-metadata");
    if (req.body.writeSubs === "true") safeFlags.push("--write-subs");

    const cacheKey = crypto
      .createHash("md5")
      .update(videoTitle + format + safeFlags.sort().join("-"))
      .digest("hex");

    const outputName = `${videoTitle}_${cacheKey}.${outputExt}`;
    const outputPath = path.join(DOWNLOAD_DIR, outputName);

    if (fs.existsSync(outputPath)) {
      console.log("✔ Using cached version:", outputName);
      return res.download(outputPath, `${videoTitle}.${outputExt}`);
    }

    let cmd;
    if (format === "mp3") {
      cmd = `"${__dirname}/yt-dlp.exe" ${safeFlags.join(" ")} -f "ba[acodec!=opus]/ba" -x --audio-format mp3 --ffmpeg-location "${FFMPEG_PATH}" -o "${outputPath}" "${videoUrl}"`;
    } else {
      cmd = `"${__dirname}/yt-dlp.exe" ${safeFlags.join(" ")} -f "bv*+ba[acodec!=opus]/b" --merge-output-format mp4 --ffmpeg-location "${FFMPEG_PATH}" -o "${outputPath}" "${videoUrl}"`;
    }

    exec(cmd, (err, stdout, stderr) => {
      console.log("Executing:", cmd);
      if (err) {
        console.error("yt-dlp error:", err);
        console.error("stderr:", stderr);
        return res.status(500).send("Download failed. Check the video URL.");
      }

      res.download(outputPath, `${videoTitle}.${outputExt}`);
    });
  });
});

app.listen(PORT, () => console.log(`yt-dlp server running: http://localhost:${PORT}`));