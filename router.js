// router.js
// Not_Lowest | aidengaming.com
// refactored to be used as a router

const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const YtDlpPath = path.join(__dirname, "yt-dlp.exe");
const FfmpegPath = path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe");
const DownloadDir = path.join(__dirname, "downloads");

if (!fs.existsSync(DownloadDir)) fs.mkdirSync(DownloadDir);

const YtDlpRouter = express.Router();

YtDlpRouter.get("/yt-dlp-help", (req, res) => {
  exec(`"${YtDlpPath}" --help`, (err, stdout) => {
    if (err) return res.status(500).send("Failed to fetch help text.");
    res.type("text").send(stdout);
  });
});

YtDlpRouter.post("/download", (req, res) => {
  const VideoUrl = req.body.url;
  const Format = req.body.format === "mp4" ? "mp4" : "mp3";

  if (!VideoUrl) return res.status(400).send("No URL provided");

  const TitleCmd = `"${YtDlpPath}" --print "%(title)s" "${VideoUrl}"`;
  exec(TitleCmd, (err, stdout) => {
    if (err || !stdout) return res.status(500).send("Failed to fetch video title.");

    const RawTitle = stdout.trim();
    const VideoTitle = RawTitle.replace(/[<>:"/\\|?*]+/g, "");
    const OutputExt = Format;

    const SafeFlags = [];
    if (req.body.writeThumbnail === "true") SafeFlags.push("--write-thumbnail");
    if (req.body.writeInfoJson === "true") SafeFlags.push("--write-info-json");
    if (req.body.writeDescription === "true") SafeFlags.push("--write-description");
    if (req.body.embedMetadata === "true") SafeFlags.push("--embed-metadata");
    if (req.body.writeSubs === "true") SafeFlags.push("--write-subs");

    const CacheKey = crypto
      .createHash("md5")
      .update(VideoTitle + Format + SafeFlags.sort().join("-"))
      .digest("hex");

    const OutputName = `${VideoTitle}_${CacheKey}.${OutputExt}`;
    const OutputPath = path.join(DownloadDir, OutputName);

    if (fs.existsSync(OutputPath)) {
      console.log("✔ Using cached version:", OutputName);
      return res.download(OutputPath, `${VideoTitle}.${OutputExt}`);
    }

    let Cmd;
    if (Format === "mp3") {
      Cmd = `"${YtDlpPath}" ${SafeFlags.join(" ")} -f "ba[acodec!=opus]/ba" -x --audio-format mp3 --ffmpeg-location "${FfmpegPath}" -o "${OutputPath}" "${VideoUrl}"`;
    } else {
      Cmd = `"${YtDlpPath}" ${SafeFlags.join(" ")} -f "bv*+ba[acodec!=opus]/b" --merge-output-format mp4 --ffmpeg-location "${FfmpegPath}" -o "${OutputPath}" "${VideoUrl}"`;
    }

    exec(Cmd, (err, stdout, stderr) => {
      console.log("Executing:", Cmd);
      if (err) {
        console.error("yt-dlp error:", err);
        console.error("stderr:", stderr);
        return res.status(500).send("Download failed. Check the video URL.");
      }

      res.download(OutputPath, `${VideoTitle}.${OutputExt}`);
    });
  });
});

module.exports = YtDlpRouter;
