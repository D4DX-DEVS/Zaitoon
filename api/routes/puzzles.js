const express = require("express");
const mongoose = require("mongoose");
const Puzzle = require("../models/puzzles");
const PuzzleAttempt = require("../models/puzzleAttempt");
const User = require("../models/user");
const { authenticateAdmin, authenticateFirebaseToken } = require("../middleware/auth");
const { upload, deleteFile, getFileKeyFromUrl } = require("../utils/cdn");

const router = express.Router();

const uploadFields = upload.fields([
	{ name: "imagefile", maxCount: 1 }
]);

function normalizeString(value) {
	if (value === undefined || value === null) return undefined;
	return String(value).trim();
}

function parseTranslations(rawTranslations) {
	if (!rawTranslations) {
		throw new Error("Translations payload is required");
	}

	let translations = rawTranslations;
	if (typeof rawTranslations === "string") {
		try {
			translations = JSON.parse(rawTranslations);
		} catch (err) {
			throw new Error("Translations must be valid JSON");
		}
	}

	const languageConfig = {
		en: { required: true },
		ml: { required: false },
		hi: { required: false },
		ur: { required: false }
	};
	const fields = ["title", "description", "explanation"];

	const normalizedTranslations = {};

	for (const [lang, config] of Object.entries(languageConfig)) {
		const sourceLang = translations[lang];

		if (!sourceLang) {
			if (config.required) {
				throw new Error(`Missing translations for language: ${lang}`);
			}
			continue;
		}

		const normalizedLang = {};
		let hasValue = false;

		for (const field of fields) {
			const value = sourceLang[field];

			if (config.required) {
				if (value === undefined || value === null || value === "") {
					throw new Error(`Missing ${field} for language ${lang}`);
				}
				normalizedLang[field] = normalizeString(value);
				continue;
			}

			if (value !== undefined && value !== null && value !== "") {
				normalizedLang[field] = normalizeString(value);
				hasValue = true;
			}
		}

		if (config.required || hasValue) {
			normalizedTranslations[lang] = normalizedLang;
		}
	}

	if (!normalizedTranslations.en) {
		throw new Error("English translations are required");
	}

	return normalizedTranslations;
}

// GET /api/puzzles - Public list with pagination and optional difficulty filter
router.get("/", async (req, res) => {
	try {
		const page = parseInt(req.query.page, 10) || 1;
		const limit = parseInt(req.query.limit, 10) || 10;
		const difficulty = normalizeString(req.query.difficulty);
		console.log("GET /api/puzzles", { page, limit, difficulty });

		const filter = {};
		if (difficulty) {
			filter.difficulty = difficulty;
		}

		const skip = (page - 1) * limit;

		const [puzzles, total] = await Promise.all([
			Puzzle.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
			Puzzle.countDocuments(filter)
		]);

		res.status(200).json({
			success: true,
			message: "Puzzles retrieved successfully",
			data: {
				puzzles,
				pagination: {
					currentPage: page,
					totalPages: Math.ceil(total / limit),
					totalPuzzles: total,
					hasNext: skip + puzzles.length < total,
					hasPrev: page > 1
				}
			}
		});
	} catch (error) {
		console.error("GET /api/puzzles error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error while fetching puzzles"
		});
	}
});

// GET /api/puzzles/:id - Public single puzzle
router.get("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		console.log("GET /api/puzzles/:id", { id });

		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid puzzle ID format"
			});
		}

		const puzzle = await Puzzle.findById(id);
		if (!puzzle) {
			return res.status(404).json({
				success: false,
				message: "Puzzle not found"
			});
		}

		res.status(200).json({
			success: true,
			message: "Puzzle retrieved successfully",
			data: puzzle
		});
	} catch (error) {
		console.error("GET /api/puzzles/:id error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error while fetching puzzle"
		});
	}
});

// POST /api/puzzles - Admin create puzzle
router.post("/", authenticateAdmin, uploadFields, async (req, res) => {
	try {
		console.log("POST /api/puzzles", { body: req.body, hasFile: !!(req.files && req.files.imagefile) });

		const imagefileFile = req.files && req.files.imagefile && req.files.imagefile[0];
		const imageUrl = normalizeString(req.body.imageUrl);

		const difficulty = normalizeString(req.body.difficulty);
		if (!difficulty) {
			return res.status(400).json({
				success: false,
				message: "Difficulty is required"
			});
		}

		const translations = parseTranslations(req.body.translations);
		const isActive = normalizeString(req.body.isActive) || "true";
		const imagefile = imagefileFile ? imagefileFile.location : undefined;

		const puzzle = new Puzzle({
			imageUrl,
			difficulty,
			imagefile,
			translations,
			isActive
		});

		const savedPuzzle = await puzzle.save();

		res.status(201).json({
			success: true,
			message: "Puzzle created successfully",
			data: savedPuzzle
		});
	} catch (error) {
		console.error("POST /api/puzzles error:", error);

		if (error.name === "ValidationError") {
			const errors = Object.values(error.errors).map(err => err.message);
			return res.status(400).json({
				success: false,
				message: "Validation error",
				errors
			});
		}

		res.status(400).json({
			success: false,
			message: error.message || "Failed to create puzzle"
		});
	}
});

// PUT /api/puzzles/:id - Admin update puzzle
router.put("/:id", authenticateAdmin, uploadFields, async (req, res) => {
	try {
		const { id } = req.params;
		console.log("PUT /api/puzzles/:id", { id, body: req.body, hasFile: !!(req.files && req.files.imagefile) });

		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid puzzle ID format"
			});
		}

		const puzzle = await Puzzle.findById(id);
		if (!puzzle) {
			return res.status(404).json({
				success: false,
				message: "Puzzle not found"
			});
		}

		const updateData = {};

		if (req.body.imageUrl !== undefined) {
			updateData.imageUrl = normalizeString(req.body.imageUrl);
		}

		const imagefileFile = req.files && req.files.imagefile && req.files.imagefile[0];
		if (imagefileFile) {
			if (puzzle.imagefile) {
				const oldKey = getFileKeyFromUrl(puzzle.imagefile);
				if (oldKey) {
					try {
						await deleteFile(oldKey);
					} catch (deleteError) {
						console.error("Error deleting puzzle imagefile:", deleteError);
					}
				}
			}
			updateData.imagefile = imagefileFile.location;
		}

		if (req.body.difficulty !== undefined) {
			updateData.difficulty = normalizeString(req.body.difficulty);
		}

		if (req.body.translations !== undefined) {
			updateData.translations = parseTranslations(req.body.translations);
		}

		if (req.body.isActive !== undefined) {
			updateData.isActive = normalizeString(req.body.isActive);
		}

		const updatedPuzzle = await Puzzle.findByIdAndUpdate(
			id,
			updateData,
			{ new: true, runValidators: true }
		);

		res.status(200).json({
			success: true,
			message: "Puzzle updated successfully",
			data: updatedPuzzle
		});
	} catch (error) {
		console.error("PUT /api/puzzles/:id error:", error);

		if (error.name === "ValidationError") {
			const errors = Object.values(error.errors).map(err => err.message);
			return res.status(400).json({
				success: false,
				message: "Validation error",
				errors
			});
		}

		res.status(400).json({
			success: false,
			message: error.message || "Failed to update puzzle"
		});
	}
});

// DELETE /api/puzzles/:id - Admin delete puzzle
router.delete("/:id", authenticateAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		console.log("DELETE /api/puzzles/:id", { id });

		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid puzzle ID format"
			});
		}

		const puzzle = await Puzzle.findById(id);
		if (!puzzle) {
			return res.status(404).json({
				success: false,
				message: "Puzzle not found"
			});
		}

		if (puzzle.imageUrl) {
			const key = getFileKeyFromUrl(puzzle.imageUrl);
			if (key) {
				try {
					await deleteFile(key);
				} catch (deleteError) {
					console.error("Error deleting puzzle image:", deleteError);
				}
			}
		}

		if (puzzle.imagefile) {
			const key = getFileKeyFromUrl(puzzle.imagefile);
			if (key) {
				try {
					await deleteFile(key);
				} catch (deleteError) {
					console.error("Error deleting puzzle imagefile:", deleteError);
				}
			}
		}

		await Puzzle.findByIdAndDelete(id);

		res.status(200).json({
			success: true,
			message: "Puzzle deleted successfully",
			data: {
				id: puzzle._id,
				imageUrl: puzzle.imageUrl
			}
		});
	} catch (error) {
		console.error("DELETE /api/puzzles/:id error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error while deleting puzzle"
		});
	}
});

// ─── Flutter App: Submit Jigsaw Puzzle Attempt ────────────────────────────────
// POST /api/puzzles/attempts
// Body: { puzzleId, starsEarned, timeSpentMs, difficulty }
router.post("/attempts", authenticateFirebaseToken, async (req, res) => {
  try {
    const firebaseUid = req.firebaseUid || req.user?.firebaseUid;
    if (!firebaseUid) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const { puzzleId, starsEarned = 0, timeSpentMs = 0, difficulty = "easy" } = req.body;
    if (!puzzleId) {
      return res.status(400).json({ success: false, message: "puzzleId is required." });
    }

    // Resolve MongoDB userId from firebaseUid
    const user = await User.findOne({ firebaseUid }).select("_id name");

    // Upsert: keep best starsEarned per user per puzzle
    const attempt = await PuzzleAttempt.findOneAndUpdate(
      { firebaseUid, puzzleId },
      {
        $set: {
          userId: user?._id || null,
          userName: user?.name || "",
          difficulty,
          timeSpentMs,
        },
        $max: { starsEarned },
      },
      { upsert: true, new: true }
    );

    console.log(`[PuzzleAttempt] UID=${firebaseUid} puzzle=${puzzleId} stars=${attempt.starsEarned}`);

    return res.status(201).json({ success: true, data: attempt });
  } catch (error) {
    console.error("[PuzzleAttempt] submit error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

module.exports = router;


