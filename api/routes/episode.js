const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const Story = require("../models/stories");
const { authenticateAdmin } = require("../middleware/auth");
const { upload, deleteFile, getFileKeyFromUrl, s3 } = require("../utils/cdn");

const router = express.Router();

// Configure multer to accept episode file uploads
const uploadFields = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "storyFile", maxCount: 1 },
  { name: "mlStoryFile", maxCount: 1 },
  { name: "urStoryFile", maxCount: 1 },
  { name: "hinStoryFile", maxCount: 1 },
  { name: "adBanner", maxCount: 1 },
  { name: "mlBanner", maxCount: 1 },
  { name: "urBanner", maxCount: 1 },
  { name: "hinBanner", maxCount: 1 },
  { name: "music", maxCount: 1 }
]);

function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

async function loadStoryAndSeason(storyId, seasonId) {
  if (!isValidObjectId(storyId) || !isValidObjectId(seasonId)) {
    return { error: { code: 400, message: "Invalid ID" } };
  }
  const story = await Story.findById(storyId);
  if (!story) return { error: { code: 404, message: "Story not found" } };
  const season = story.seasons.id(seasonId);
  if (!season) return { error: { code: 404, message: "Season not found" } };
  return { story, season };
}

// GET /api/episodes/health - health check endpoint (public)
router.get("/episodes/health", async (req, res) => {
  try {
    // Check database connectivity
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting"
    };

    // Try to query stories to verify database access
    const storiesCount = await Story.countDocuments();
    
    // Count total episodes across all stories and seasons
    const stories = await Story.find({});
    let totalEpisodes = 0;
    let episodesWithMusic = 0;
    
    stories.forEach(story => {
      if (story.seasons && story.seasons.length > 0) {
        story.seasons.forEach(season => {
          if (season.episodes && season.episodes.length > 0) {
            totalEpisodes += season.episodes.length;
            season.episodes.forEach(episode => {
              if (episode.music) {
                episodesWithMusic++;
              }
            });
          }
        });
      }
    });

    const isHealthy = dbState === 1;

    return res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      database: {
        status: dbStates[dbState],
        connected: dbState === 1
      },
      episodes: {
        total: totalEpisodes,
        withMusic: episodesWithMusic,
        storiesCount: storiesCount
      },
      message: isHealthy 
        ? "Episode API is healthy and operational" 
        : "Episode API is unhealthy - database connection issue"
    });
  } catch (err) {
    console.error("Health check error:", err);
    return res.status(503).json({
      success: false,
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: err.message,
      message: "Health check failed"
    });
  }
});

// GET /api/stories/:storyId/seasons/:seasonId/episodes - list episodes (public)
router.get("/stories/:storyId/seasons/:seasonId/episodes", async (req, res) => {
  try {
    const { storyId, seasonId } = req.params;
    const { page: pageQuery, limit: limitQuery } = req.query;
    
    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 10));
    const skip = (page - 1) * limit;

    const result = await loadStoryAndSeason(storyId, seasonId);
    if (result.error) return res.status(result.error.code).json({ success: false, message: result.error.message });
    const { season } = result;
    
    const allEpisodes = season.episodes || [];
    const total = allEpisodes.length;
    const episodes = allEpisodes.slice(skip, skip + limit);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({ 
      success: true, 
      data: episodes,
      pagination: {
        totalEpisodes: total,
        page,
        limit,
        totalPages,
        hasNext: skip + episodes.length < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error("List episodes error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/stories/:storyId/seasons/:seasonId/episodes/:episodeId - get one (public)
router.get("/stories/:storyId/seasons/:seasonId/episodes/:episodeId", async (req, res) => {
  try {
    const { storyId, seasonId, episodeId } = req.params;
    if (!isValidObjectId(episodeId)) {
      return res.status(400).json({ success: false, message: "Invalid episode ID" });
    }
    const result = await loadStoryAndSeason(storyId, seasonId);
    if (result.error) return res.status(result.error.code).json({ success: false, message: result.error.message });
    const { season } = result;
    const episode = season.episodes.id(episodeId);
    if (!episode) return res.status(404).json({ success: false, message: "Episode not found" });
    return res.status(200).json({ success: true, data: episode });
  } catch (err) {
    console.error("Get episode error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/stories/:storyId/seasons/:seasonId/episodes/:episodeId/download-pdf - get PDF download URL (public)
// Query: lang=en | ml | ur | hin (default: en)
router.get("/stories/:storyId/seasons/:seasonId/episodes/:episodeId/download-pdf", async (req, res) => {
  try {
    const { storyId, seasonId, episodeId } = req.params;
    const lang = (req.query.lang || "en").toLowerCase();
    if (!isValidObjectId(episodeId)) {
      return res.status(400).json({ success: false, message: "Invalid episode ID" });
    }
    const result = await loadStoryAndSeason(storyId, seasonId);
    if (result.error) return res.status(result.error.code).json({ success: false, message: result.error.message });
    const { season } = result;
    const episode = season.episodes.id(episodeId);
    if (!episode) return res.status(404).json({ success: false, message: "Episode not found" });

    const langMap = { en: "storyFile", ml: "mlStoryFile", ur: "urStoryFile", hin: "hinStoryFile" };
    const field = langMap[lang] || langMap.en;
    const fileUrl = episode[field];
    if (!fileUrl) {
      return res.status(404).json({
        success: false,
        message: `Story file not available for language: ${lang}`
      });
    }

    const title = episode.title || episode.mlTitle || "episode";
    const safeTitle = String(title).replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
    const filename = `${safeTitle}.pdf`;

    // Try to generate a signed URL with a clean PDF filename for download.
    let downloadUrl = fileUrl;
    try {
      const key = getFileKeyFromUrl(fileUrl);
      const bucket = process.env.DO_SPACES_BUCKET;
      if (key && bucket && s3) {
        const signedUrl = s3.getSignedUrl("getObject", {
          Bucket: bucket,
          Key: key,
          Expires: 300,
          ResponseContentDisposition: `attachment; filename="${filename}"`
        });
        if (signedUrl) {
          downloadUrl = signedUrl;
        }
      }
    } catch (signErr) {
      console.error("Episode download-pdf signing error:", signErr);
    }

    return res.status(200).json({
      success: true,
      message: "PDF download ready",
      data: { downloadUrl, filename }
    });
  } catch (err) {
    console.error("Episode download-pdf error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/stories/:storyId/seasons/:seasonId/episodes - create (admin)
router.post("/stories/:storyId/seasons/:seasonId/episodes", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { storyId, seasonId } = req.params;
    const { 
      title, 
      mlTitle,
      urTitle,
      hinTitle,
      status,
      readTime,
      highlight,
      highlightExpiresAt
    } = req.body;
    const coverImageFile = req.files && req.files.coverImage && req.files.coverImage[0];
    const storyFileFile = req.files && req.files.storyFile && req.files.storyFile[0];
    const mlStoryFileFile = req.files && req.files.mlStoryFile && req.files.mlStoryFile[0];
    const urStoryFileFile = req.files && req.files.urStoryFile && req.files.urStoryFile[0];
    const hinStoryFileFile = req.files && req.files.hinStoryFile && req.files.hinStoryFile[0];
    const adBannerFile = req.files && req.files.adBanner && req.files.adBanner[0];
    const mlBannerFile = req.files && req.files.mlBanner && req.files.mlBanner[0];
    const urBannerFile = req.files && req.files.urBanner && req.files.urBanner[0];
    const hinBannerFile = req.files && req.files.hinBanner && req.files.hinBanner[0];
    const musicFile = req.files && req.files.music && req.files.music[0];
    
    if (!title || !storyFileFile) {
      return res.status(400).json({ 
        success: false, 
        message: "title and storyFile are required" 
      });
    }

    // Validate music file format if provided
    if (musicFile) {
      const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3'];
      const allowedExtensions = ['.mp3'];
      const fileExtension = path.extname(musicFile.originalname).toLowerCase();
      
      if (!allowedMimeTypes.includes(musicFile.mimetype) && !allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          success: false, 
          message: "Music file must be in MP3 format" 
        });
      }
    }
    
    const result = await loadStoryAndSeason(storyId, seasonId);
    if (result.error) return res.status(result.error.code).json({ success: false, message: result.error.message });
    const { story, season } = result;

    season.episodes = season.episodes || [];
    season.episodes.push({ 
      title, 
      mlTitle,
      urTitle,
      hinTitle,
      status,
      coverImage: coverImageFile ? coverImageFile.location : req.body.coverImage,
      readTime,
      storyFile: storyFileFile.location,
      mlStoryFile: mlStoryFileFile ? mlStoryFileFile.location : req.body.mlStoryFile,
      urStoryFile: urStoryFileFile ? urStoryFileFile.location : req.body.urStoryFile,
      hinStoryFile: hinStoryFileFile ? hinStoryFileFile.location : req.body.hinStoryFile,
      adBanner: adBannerFile ? adBannerFile.location : req.body.adBanner,
      mlBanner: mlBannerFile ? mlBannerFile.location : req.body.mlBanner,
      urBanner: urBannerFile ? urBannerFile.location : req.body.urBanner,
      hinBanner: hinBannerFile ? hinBannerFile.location : req.body.hinBanner,
      highlight,
      highlightExpiresAt: highlightExpiresAt ? new Date(highlightExpiresAt) : null,
      music: musicFile ? musicFile.location : req.body.music
    });
    await story.save();

    const created = season.episodes[season.episodes.length - 1];
    return res.status(201).json({ success: true, message: "Episode created", data: created });
  } catch (err) {
    console.error("Create episode error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/stories/:storyId/seasons/:seasonId/episodes/reorder - reorder episodes (admin)
router.put("/stories/:storyId/seasons/:seasonId/episodes/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { storyId, seasonId } = req.params;
    const { episodeIds } = req.body;
    if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
      return res.status(400).json({ success: false, message: "episodeIds array required" });
    }
    const result = await loadStoryAndSeason(storyId, seasonId);
    if (result.error) return res.status(result.error.code).json({ success: false, message: result.error.message });
    const { story, season } = result;
    const episodes = season.episodes || [];
    const byId = new Map(episodes.map((ep) => [ep._id.toString(), ep]));
    const ordered = [];
    for (const id of episodeIds) {
      const ep = byId.get(String(id));
      if (ep) ordered.push(ep);
    }
    if (ordered.length !== episodes.length) {
      return res.status(400).json({ success: false, message: "episodeIds must match season episodes" });
    }
    season.episodes = ordered;
    await story.save();
    return res.status(200).json({ success: true, message: "Episodes reordered", data: ordered });
  } catch (err) {
    console.error("Reorder episodes error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// PUT /api/stories/:storyId/seasons/:seasonId/episodes/:episodeId - update (admin)
router.put("/stories/:storyId/seasons/:seasonId/episodes/:episodeId", authenticateAdmin, uploadFields, async (req, res) => {
  try {
    const { storyId, seasonId, episodeId } = req.params;
    const { 
      title, 
      mlTitle,
      urTitle,
      hinTitle,
      status,
      readTime,
      highlight,
      highlightExpiresAt
    } = req.body;
    
    if (!isValidObjectId(episodeId)) {
      return res.status(400).json({ success: false, message: "Invalid episode ID" });
    }
    const result = await loadStoryAndSeason(storyId, seasonId);
    if (result.error) return res.status(result.error.code).json({ success: false, message: result.error.message });
    const { story, season } = result;

    const episode = season.episodes.id(episodeId);
    if (!episode) return res.status(404).json({ success: false, message: "Episode not found" });

    // Handle file uploads
    const coverImageFile = req.files && req.files.coverImage && req.files.coverImage[0];
    const storyFileFile = req.files && req.files.storyFile && req.files.storyFile[0];
    const mlStoryFileFile = req.files && req.files.mlStoryFile && req.files.mlStoryFile[0];
    const urStoryFileFile = req.files && req.files.urStoryFile && req.files.urStoryFile[0];
    const hinStoryFileFile = req.files && req.files.hinStoryFile && req.files.hinStoryFile[0];
    const adBannerFile = req.files && req.files.adBanner && req.files.adBanner[0];
    const mlBannerFile = req.files && req.files.mlBanner && req.files.mlBanner[0];
    const urBannerFile = req.files && req.files.urBanner && req.files.urBanner[0];
    const hinBannerFile = req.files && req.files.hinBanner && req.files.hinBanner[0];
    const musicFile = req.files && req.files.music && req.files.music[0];

    if (title != null) episode.title = title;
    if (mlTitle != null) episode.mlTitle = mlTitle;
    if (urTitle != null) episode.urTitle = urTitle;
    if (hinTitle != null) episode.hinTitle = hinTitle;
    if (status != null) episode.status = status;
    if (readTime != null) episode.readTime = readTime;
    if (highlight != null) {
      episode.highlight = highlight;
      // When enabling highlight with an expiry, store it; when disabling, clear expiry
      if (highlight === "Enable" && highlightExpiresAt) {
        episode.highlightExpiresAt = new Date(highlightExpiresAt);
      } else if (highlight === "Disable") {
        episode.highlightExpiresAt = null;
      }
    } else if (highlightExpiresAt !== undefined) {
      episode.highlightExpiresAt = highlightExpiresAt ? new Date(highlightExpiresAt) : null;
    }

    // Handle file replacements with CDN cleanup
    if (coverImageFile) {
      if (episode.coverImage) {
        const oldKey = getFileKeyFromUrl(episode.coverImage);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.coverImage = coverImageFile.location;
    } else if (req.body.coverImage != null) {
      episode.coverImage = req.body.coverImage;
    }

    if (storyFileFile) {
      if (episode.storyFile) {
        const oldKey = getFileKeyFromUrl(episode.storyFile);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.storyFile = storyFileFile.location;
    } else if (req.body.storyFile != null) {
      episode.storyFile = req.body.storyFile;
    }

    if (mlStoryFileFile) {
      if (episode.mlStoryFile) {
        const oldKey = getFileKeyFromUrl(episode.mlStoryFile);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.mlStoryFile = mlStoryFileFile.location;
    } else if (req.body.mlStoryFile != null) {
      episode.mlStoryFile = req.body.mlStoryFile;
    }

    if (urStoryFileFile) {
      if (episode.urStoryFile) {
        const oldKey = getFileKeyFromUrl(episode.urStoryFile);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.urStoryFile = urStoryFileFile.location;
    } else if (req.body.urStoryFile != null) {
      episode.urStoryFile = req.body.urStoryFile;
    }

    if (hinStoryFileFile) {
      if (episode.hinStoryFile) {
        const oldKey = getFileKeyFromUrl(episode.hinStoryFile);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.hinStoryFile = hinStoryFileFile.location;
    } else if (req.body.hinStoryFile != null) {
      episode.hinStoryFile = req.body.hinStoryFile;
    }

    if (adBannerFile) {
      if (episode.adBanner) {
        const oldKey = getFileKeyFromUrl(episode.adBanner);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.adBanner = adBannerFile.location;
    } else if (req.body.adBanner != null) {
      episode.adBanner = req.body.adBanner;
    }

    if (mlBannerFile) {
      if (episode.mlBanner) {
        const oldKey = getFileKeyFromUrl(episode.mlBanner);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.mlBanner = mlBannerFile.location;
    } else if (req.body.mlBanner != null) {
      episode.mlBanner = req.body.mlBanner;
    }

    if (urBannerFile) {
      if (episode.urBanner) {
        const oldKey = getFileKeyFromUrl(episode.urBanner);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.urBanner = urBannerFile.location;
    } else if (req.body.urBanner != null) {
      episode.urBanner = req.body.urBanner;
    }

    if (hinBannerFile) {
      if (episode.hinBanner) {
        const oldKey = getFileKeyFromUrl(episode.hinBanner);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.hinBanner = hinBannerFile.location;
    } else if (req.body.hinBanner != null) {
      episode.hinBanner = req.body.hinBanner;
    }

    if (musicFile) {
      // Validate music file format
      const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3'];
      const allowedExtensions = ['.mp3'];
      const fileExtension = path.extname(musicFile.originalname).toLowerCase();
      
      if (!allowedMimeTypes.includes(musicFile.mimetype) && !allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          success: false, 
          message: "Music file must be in MP3 format" 
        });
      }

      if (episode.music) {
        const oldKey = getFileKeyFromUrl(episode.music);
        if (oldKey) await deleteFile(oldKey);
      }
      episode.music = musicFile.location;
    } else if (req.body.music != null) {
      episode.music = req.body.music;
    }

    await story.save();
    return res.status(200).json({ success: true, message: "Episode updated", data: episode });
  } catch (err) {
    console.error("Update episode error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE /api/stories/:storyId/seasons/:seasonId/episodes/:episodeId - delete (admin)
router.delete("/stories/:storyId/seasons/:seasonId/episodes/:episodeId", authenticateAdmin, async (req, res) => {
  try {
    const { storyId, seasonId, episodeId } = req.params;
    if (!isValidObjectId(episodeId)) {
      return res.status(400).json({ success: false, message: "Invalid episode ID" });
    }
    const result = await loadStoryAndSeason(storyId, seasonId);
    if (result.error) return res.status(result.error.code).json({ success: false, message: result.error.message });
    const { story, season } = result;

    const episode = season.episodes.id(episodeId);
    if (!episode) return res.status(404).json({ success: false, message: "Episode not found" });

    // Delete all episode files from CDN
    const episodeFiles = [
      episode.coverImage,
      episode.storyFile,
      episode.mlStoryFile,
      episode.urStoryFile,
      episode.hinStoryFile,
      episode.adBanner,
      episode.mlBanner,
      episode.urBanner,
      episode.hinBanner,
      episode.music
    ];
    
    for (const fileUrl of episodeFiles) {
      if (fileUrl) {
        const fileKey = getFileKeyFromUrl(fileUrl);
        if (fileKey) await deleteFile(fileKey);
      }
    }

    episode.deleteOne();
    await story.save();
    return res.status(200).json({ success: true, message: "Episode deleted" });
  } catch (err) {
    console.error("Delete episode error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;


