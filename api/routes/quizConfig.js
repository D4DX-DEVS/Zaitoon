const express = require("express");
const QuizConfig = require("../models/quizConfig");
const { authenticateToken } = require("../middleware/auth");
const { getCurrentOrLatestQuizConfig } = require("../utils/quizConfigResolver");
const router = express.Router();

// ─── helpers ─────────────────────────────────────────────────────────────────
function validateDates(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "Invalid date format";
  if (start >= end) return "Start date must be before end date";
  return null;
}

// ─── GET /api/quizzes/config/all  (list ALL configs) ─────────────────────────
router.get("/all", async (req, res) => {
  try {
    const configs = await QuizConfig.find().sort({ createdAt: -1 }).lean();
    const now = new Date();
    const data = configs.map(c => ({
      ...c,
      isLive: !!(c.isEnable && now >= c.startDate && now <= c.endDate)
    }));
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List quiz configs error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── GET /api/quizzes/config/:id  (get one by id) ────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    if (req.params.id === "all") return; // handled above
    const config = await QuizConfig.findById(req.params.id);
    if (!config) return res.status(404).json({ success: false, message: "Quiz configuration not found" });
    res.status(200).json({ success: true, data: config.toObject() });
  } catch (error) {
    console.error("Get quiz config by id error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/quizzes/config - Get quiz configuration (public)
router.get("/", async (req, res) => {
  try {
    let config = await getCurrentOrLatestQuizConfig();
    
    // If no config exists, return default structure
    if (!config) {
      return res.status(200).json({
        success: true,
        message: "Quiz configuration retrieved successfully",
        data: {
          startDate: null,
          endDate: null,
          numberOfQuestions: null,
          questionsRandomization: false,
          isEnable: false,
          isLive: false
        }
      });
    }

    // Convert to object to include virtual fields
    const configObj = config.toObject();

    res.status(200).json({
      success: true,
      message: "Quiz configuration retrieved successfully",
      data: configObj
    });
  } catch (error) {
    console.error("Get quiz config error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quiz configuration"
    });
  }
});

// POST /api/quizzes/config - Create a new quiz configuration (multiple allowed)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, startDate, endDate, numberOfQuestions, questionsRandomization = false, isEnable = true, timezone } = req.body;

    if (!startDate || !endDate || numberOfQuestions === undefined) {
      return res.status(400).json({ success: false, message: "Start date, end date, and number of questions are required" });
    }

    const dateErr = validateDates(startDate, endDate);
    if (dateErr) return res.status(400).json({ success: false, message: dateErr });

    const numQuestions = parseInt(numberOfQuestions, 10);
    if (isNaN(numQuestions) || numQuestions < 1) {
      return res.status(400).json({ success: false, message: "Number of questions must be an integer >= 1" });
    }

    const newConfig = new QuizConfig({
      name: (name && String(name).trim()) || "Daily Quiz",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      numberOfQuestions: numQuestions,
      questionsRandomization: Boolean(questionsRandomization),
      isEnable: Boolean(isEnable),
      ...(timezone != null && { timezone: String(timezone).trim() || undefined })
    });

    const saved = await newConfig.save();
    res.status(201).json({ success: true, message: "Quiz configuration created successfully", data: saved.toObject() });
  } catch (error) {
    console.error("Create quiz config error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Validation error", errors: Object.values(error.errors).map(e => e.message) });
    }
    res.status(500).json({ success: false, message: "Internal server error while creating quiz configuration" });
  }
});

// PUT /api/quizzes/config/:id - Update a specific config by ID
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { name, startDate, endDate, numberOfQuestions, questionsRandomization, isEnable, timezone } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (startDate !== undefined) { const s = new Date(startDate); if (!isNaN(s)) updateData.startDate = s; }
    if (endDate !== undefined) { const e = new Date(endDate); if (!isNaN(e)) updateData.endDate = e; }
    if (numberOfQuestions !== undefined) { const n = parseInt(numberOfQuestions, 10); if (!isNaN(n) && n >= 1) updateData.numberOfQuestions = n; }
    if (questionsRandomization !== undefined) updateData.questionsRandomization = Boolean(questionsRandomization);
    if (isEnable !== undefined) updateData.isEnable = Boolean(isEnable);
    if (timezone !== undefined) updateData.timezone = String(timezone).trim() || "Asia/Kolkata";

    if (updateData.startDate || updateData.endDate) {
      const existing = await QuizConfig.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: "Quiz configuration not found" });
      const s = updateData.startDate || existing.startDate;
      const e = updateData.endDate || existing.endDate;
      if (s >= e) return res.status(400).json({ success: false, message: "Start date must be before end date" });
    }

    const updated = await QuizConfig.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "Quiz configuration not found" });
    res.status(200).json({ success: true, message: "Quiz configuration updated successfully", data: updated.toObject() });
  } catch (error) {
    console.error("Update quiz config error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Validation error", errors: Object.values(error.errors).map(e => e.message) });
    }
    res.status(500).json({ success: false, message: "Internal server error while updating quiz configuration" });
  }
});

// PUT /api/quizzes/config - Backward-compat: update first config
router.put("/", authenticateToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      numberOfQuestions,
      questionsRandomization,
      isEnable,
      timezone
    } = req.body;

    const updateData = {};

    // Build update object with only provided fields
    if (startDate !== undefined) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid start date format"
        });
      }
      updateData.startDate = start;
    }

    if (endDate !== undefined) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid end date format"
        });
      }
      updateData.endDate = end;
    }

    if (numberOfQuestions !== undefined) {
      const numQuestions = parseInt(numberOfQuestions, 10);
      if (isNaN(numQuestions) || numQuestions < 1) {
        return res.status(400).json({
          success: false,
          message: "Number of questions must be an integer greater than or equal to 1"
        });
      }
      updateData.numberOfQuestions = numQuestions;
    }

    if (questionsRandomization !== undefined) {
      updateData.questionsRandomization = Boolean(questionsRandomization);
    }

    if (isEnable !== undefined) {
      updateData.isEnable = Boolean(isEnable);
    }

    if (timezone !== undefined) {
      updateData.timezone = String(timezone).trim() || "Asia/Kolkata";
    }

    // Several configs can exist, so target the current one instead of whichever
    // document comes back first.
    const existing = await getCurrentOrLatestQuizConfig();

    // Validate startDate < endDate if both are being updated
    if (updateData.startDate && updateData.endDate) {
      if (updateData.startDate >= updateData.endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date must be before end date"
        });
      }
    } else if (updateData.startDate) {
      // If only startDate is updated, check against existing endDate
      if (existing && updateData.startDate >= existing.endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date must be before end date"
        });
      }
    } else if (updateData.endDate) {
      // If only endDate is updated, check against existing startDate
      if (existing && existing.startDate >= updateData.endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date must be before end date"
        });
      }
    }

    // Update the resolved config, or create one when none exists yet
    const updatedConfig = await QuizConfig.findOneAndUpdate(
      existing ? { _id: existing._id } : {},
      updateData,
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    const configObj = updatedConfig.toObject();

    res.status(200).json({
      success: true,
      message: "Quiz configuration updated successfully",
      data: configObj
    });
  } catch (error) {
    console.error("Update quiz config error:", error);
    
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while updating quiz configuration"
    });
  }
});

// DELETE /api/quizzes/config/:id - Delete a specific config by ID
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const deleted = await QuizConfig.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Quiz configuration not found" });
    res.status(200).json({ success: true, message: "Quiz configuration deleted successfully", data: { id: deleted._id } });
  } catch (error) {
    console.error("Delete quiz config error:", error);
    res.status(500).json({ success: false, message: "Internal server error while deleting quiz configuration" });
  }
});

// POST /api/quizzes/config/:id/claim-unlinked
// Bulk-assign all quizzes & questions with no config to this config
router.post("/:id/claim-unlinked", authenticateToken, async (req, res) => {
  try {
    const Quiz = require("../models/quiz");
    const Question = require("../models/question");

    const config = await QuizConfig.findById(req.params.id);
    if (!config) return res.status(404).json({ success: false, message: "Quiz configuration not found" });

    const [quizResult, questionResult] = await Promise.all([
      Quiz.updateMany(
        { $or: [{ quizConfigId: null }, { quizConfigId: { $exists: false } }] },
        { $set: { quizConfigId: config._id } }
      ),
      Question.updateMany(
        { $or: [{ quizConfigId: null }, { quizConfigId: { $exists: false } }] },
        { $set: { quizConfigId: config._id } }
      )
    ]);

    res.status(200).json({
      success: true,
      message: `Linked ${quizResult.modifiedCount} quizzes and ${questionResult.modifiedCount} questions to "${config.name}"`,
      data: { quizzesClaimed: quizResult.modifiedCount, questionsClaimed: questionResult.modifiedCount }
    });
  } catch (error) {
    console.error("Claim unlinked error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// DELETE /api/quizzes/config - Backward-compat: delete first config
router.delete("/", authenticateToken, async (req, res) => {
  try {
    const deletedConfig = await QuizConfig.findOneAndDelete({});

    if (!deletedConfig) {
      return res.status(404).json({
        success: false,
        message: "Quiz configuration not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Quiz configuration deleted successfully",
      data: {
        id: deletedConfig._id
      }
    });
  } catch (error) {
    console.error("Delete quiz config error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting quiz configuration"
    });
  }
});

module.exports = router;
