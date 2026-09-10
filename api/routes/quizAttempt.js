const express = require("express");
const fs = require("fs");
const path = require("path");
const QuizAttempt = require("../models/quizAttempt");
const Quiz = require("../models/quiz");
const QuizConfig = require("../models/quizConfig");
const QuizQuestion = require("../models/quizQuestion");
const User = require("../models/user");
const { authenticateUser, authenticateToken } = require("../middleware/auth");
const { retryAsync } = require("../utils/retry");
const { getCurrentOrLatestQuizConfig } = require("../utils/quizConfigResolver");
const router = express.Router();

// GET /api/quiz-attempts/me/today - Get today's attempt for logged-in user
router.get("/me/today", authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const attempt = await QuizAttempt.findOne({
      userId,
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    })
      .populate("userId", "name email class")
      .sort({ createdAt: -1 })
      .lean();

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "No quiz attempt found for today"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Today's quiz attempt retrieved successfully",
      data: attempt
    });
  } catch (error) {
    console.error("Get my today's quiz attempt error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching today's quiz attempt"
    });
  }
});

// GET /api/quiz-attempts/me - Get my attempts (paginated)
router.get("/me", authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const { page: pageQuery, limit: limitQuery } = req.query;

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 20));
    const skip = (page - 1) * limit;

    const [attempts, total] = await Promise.all([
      QuizAttempt.find({ userId })
        .populate("userId", "name email class")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      QuizAttempt.countDocuments({ userId })
    ]);

    return res.status(200).json({
      success: true,
      message: "My quiz attempts retrieved successfully",
      data: {
        attempts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("Get my quiz attempts error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching my quiz attempts"
    });
  }
});

// POST /api/quiz-attempts/attempt - Submit quiz attempt (no token required)
router.post("/attempt", async (req, res) => {
  try {
    const { language, questions, answers, name, email, class: userClass, phone } = req.body;
    const userId = req.userId || null;
    let user = null;
    if (userId) {
      user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
    }
    const phoneFromBody = (phone && String(phone).trim()) || "";
    const userSnapshot = user
      ? { name: user.name || "", email: user.email || "", class: user.class || "", phone: (user.phone && String(user.phone).trim()) || phoneFromBody }
      : { name: (name && String(name).trim()) || "", email: (email && String(email).trim().toLowerCase()) || "", class: (userClass && String(userClass).trim()) || "", phone: phoneFromBody };

    const emailNormalized = (userSnapshot.email || "").trim().toLowerCase();
    if (!emailNormalized) {
      return res.status(400).json({
        success: false,
        message: "Email is required for quiz submission."
      });
    }
    const phoneTrimmed = (userSnapshot.phone || "").trim();
    if (!phoneTrimmed) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required for quiz submission."
      });
    }

    // One attempt per email per day
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const existingByEmail = await QuizAttempt.findOne({
      $or: [
        { emailNormalized },
        { "userSnapshot.email": emailNormalized }
      ],
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });
    if (existingByEmail) {
      return res.status(409).json({
        success: false,
        message: "You have already attempted today. Come back tomorrow!"
      });
    }

    // Validate required fields
    if (!language || !questions || !answers) {
      return res.status(400).json({
        success: false,
        message: "Language, questions, and answers are required"
      });
    }

    // Validate language
    if (!["en", "ml"].includes(language)) {
      return res.status(400).json({
        success: false,
        message: "Language must be 'en' or 'ml'"
      });
    }

    const config = await getCurrentOrLatestQuizConfig();
    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Quiz configuration not found. Quiz is not available."
      });
    }

    // Validate quiz is enabled
    if (!config.isEnable) {
      return res.status(400).json({
        success: false,
        message: "Quiz is currently disabled."
      });
    }

    const now = new Date();
    if (now < config.startDate || now > config.endDate) {
      return res.status(400).json({
        success: false,
        message: "Quiz is not available at this time. Please check the quiz schedule."
      });
    }

    // Validate questions array
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Questions must be a non-empty array"
      });
    }

    // Validate questions.length matches config.numberOfQuestions
    if (questions.length !== config.numberOfQuestions) {
      return res.status(400).json({
        success: false,
        message: `Number of questions (${questions.length}) does not match required number (${config.numberOfQuestions})`
      });
    }

    // Validate answers array
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Answers must be a non-empty array"
      });
    }

    // Validate answers.length matches questions.length
    if (answers.length !== questions.length) {
      return res.status(400).json({
        success: false,
        message: `Number of answers (${answers.length}) does not match number of questions (${questions.length})`
      });
    }

    // Validate and process questions (snapshot)
    const questionSnapshots = [];
    for (const q of questions) {
      if (!q._id || !q.type || !q.question_en || !q.question_ml || 
          !q.options_en || !q.options_ml || q.correct_answer === undefined || !q.difficulty) {
        return res.status(400).json({
          success: false,
          message: "Invalid question format. All question fields are required."
        });
      }

      // Validate options are valid JSON arrays
      try {
        const optionsEn = JSON.parse(q.options_en);
        const optionsMl = JSON.parse(q.options_ml);
        if (!Array.isArray(optionsEn) || !Array.isArray(optionsMl)) {
          return res.status(400).json({
            success: false,
            message: "Question options must be valid JSON arrays"
          });
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Question options must be valid JSON strings"
        });
      }

      questionSnapshots.push({
        _id: String(q._id),
        type: String(q.type).trim(),
        question_en: String(q.question_en).trim(),
        question_ml: String(q.question_ml).trim(),
        options_en: String(q.options_en),
        options_ml: String(q.options_ml),
        correct_answer: parseInt(q.correct_answer, 10),
        difficulty: String(q.difficulty).trim()
      });
    }

    // Validate and process answers
    const processedAnswers = [];
    let totalDuration = 0;
    let score = 0;

    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      const question = questionSnapshots[i];

      if (answer.attemptedAnswer === undefined || answer.duration === undefined) {
        return res.status(400).json({
          success: false,
          message: `Answer ${i + 1} is missing required fields (attemptedAnswer, duration)`
        });
      }

      const attemptedAnswer = parseInt(answer.attemptedAnswer, 10);
      const duration = parseFloat(answer.duration);

      if (isNaN(attemptedAnswer) || attemptedAnswer < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid attemptedAnswer for question ${i + 1}`
        });
      }

      if (isNaN(duration) || duration < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid duration for question ${i + 1}`
        });
      }

      // Check if answer is correct
      const isCorrect = attemptedAnswer === question.correct_answer;
      if (isCorrect) {
        score += 1;
      }

      processedAnswers.push({
        attemptedAnswer,
        isCorrect,
        duration
      });

      totalDuration += duration;
    }

    const percentage = questions.length > 0 
      ? Math.round((score / questions.length) * 100 * 100) / 100 
      : 0;

    const quizAttempt = new QuizAttempt({
      userId,
      userSnapshot,
      emailNormalized,
      language,
      questions: questionSnapshots,
      answers: processedAnswers,
      score,
      percentage,
      totalDuration
    });

    const populatedAttempt = await retryAsync(async () => {
      const saved = await quizAttempt.save();
      return QuizAttempt.findById(saved._id).populate("userId", "name email class").lean();
    }, { maxAttempts: 3, delayMs: 500 });

    res.status(201).json({
      success: true,
      message: "Quiz attempt submitted successfully",
      data: populatedAttempt
    });
  } catch (error) {
    console.error("Submit quiz attempt error:", error);
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
      message: "Internal server error while submitting quiz attempt"
    });
  }
});

// GET /api/quiz-attempts/admin/all - Get all attempts (admin only, paginated, searchable)
router.get("/admin/all", authenticateToken, async (req, res) => {
  try {
    const {
      page: pageQuery,
      limit: limitQuery,
      search,
      startDate,
      endDate,
      email: filterEmail,
      userId: filterUserId,
      configId,
      quizId
    } = req.query;

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    // A single quiz beats a whole config. Legacy null-quizId attempts belong to
    // no single quiz, so they are deliberately excluded from the quizId branch.
    if (quizId && quizId.match(/^[0-9a-fA-F]{24}$/)) {
      filter.quizId = quizId;
    } else if (configId) {
      // Filter by quiz config — include null-quizId (legacy) attempts so they are not dropped
      const quizIds = await Quiz.distinct("_id", { quizConfigId: configId });
      filter.quizId = { $in: [null, ...quizIds] };
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          filter.createdAt.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    // Filter by userId
    if (filterUserId && filterUserId.match(/^[0-9a-fA-F]{24}$/)) {
      filter.userId = filterUserId;
    }

    // Filter by email
    if (filterEmail) {
      const emailLower = filterEmail.trim().toLowerCase();
      filter.$or = [
        { emailNormalized: emailLower },
        { "userSnapshot.email": emailLower }
      ];
    }

    // Search by name, email, or phone
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const searchConditions = [
        { "userSnapshot.name": searchRegex },
        { "userSnapshot.email": searchRegex },
        { "userSnapshot.phone": searchRegex },
        { emailNormalized: searchRegex }
      ];
      if (filter.$or) {
        // Combine email filter with search using $and
        filter.$and = [
          { $or: filter.$or },
          { $or: searchConditions }
        ];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const [attempts, total] = await Promise.all([
      QuizAttempt.find(filter)
        .populate("userId", "name email class")
        .sort({ score: -1, totalDuration: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      QuizAttempt.countDocuments(filter)
    ]);

    // Format attendees
    const attendees = attempts.map((attempt, index) => {
      const fromUser = attempt.userId && typeof attempt.userId === "object" ? attempt.userId : null;
      const fromSnapshot = attempt.userSnapshot || {};
      return {
        rank: skip + index + 1,
        attemptId: attempt._id,
        userId: attempt.userId?._id || attempt.userId,
        userName: fromUser?.name || fromSnapshot.name || "",
        userEmail: fromUser?.email || fromSnapshot.email || "",
        userClass: fromUser?.class || fromSnapshot.class || "",
        userPhone: fromUser?.phone || fromSnapshot.phone || "",
        score: attempt.score,
        percentage: attempt.percentage,
        totalDuration: attempt.totalDuration,
        language: attempt.language,
        createdAt: attempt.createdAt
      };
    });

    res.status(200).json({
      success: true,
      message: "Quiz attempts retrieved successfully",
      data: {
        attendees,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("Get admin quiz attempts error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quiz attempts"
    });
  }
});

// DELETE /api/quiz-attempts/:id - Delete attempt by ID (admin only)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID format"
      });
    }

    const attempt = await QuizAttempt.findByIdAndDelete(id);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Quiz attempt not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Quiz attempt deleted successfully",
      data: { id: attempt._id }
    });
  } catch (error) {
    console.error("Delete quiz attempt error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting quiz attempt"
    });
  }
});

// GET /api/quiz-attempts/:id - Get single attempt by ID (admin only)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID format"
      });
    }

    const attempt = await QuizAttempt.findById(id)
      .populate("userId", "name email class")
      .lean();

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Quiz attempt not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Quiz attempt retrieved successfully",
      data: attempt
    });
  } catch (error) {
    console.error("Get quiz attempt error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quiz attempt"
    });
  }
});

// POST /api/quiz-attempts/admin/clear-by-quiz/:quizId - Clear one quiz's board (admin only).
//
// Two independent switches in the body:
//   deleteAttempts  - permanently delete this quiz's own QuizAttempt rows
//   clearCarryOver  - drop includedQuizIds so borrowed points stop showing
//
// Unlike clear-all this writes NO backup - deletion is final.
//
// Attempts belonging to the carried-over quizzes are never touched; those are
// other quizzes' data. Note that deleting this quiz's attempts does remove
// these points from any other quiz that carries over from it, since boards are
// computed from attempt rows at read time.
router.post("/admin/clear-by-quiz/:quizId", authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const { deleteAttempts = false, clearCarryOver = false } = req.body || {};

    if (!quizId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid quiz ID format" });
    }

    if (!deleteAttempts && !clearCarryOver) {
      return res.status(400).json({
        success: false,
        message: "Nothing to clear. Set deleteAttempts and/or clearCarryOver."
      });
    }

    const quiz = await Quiz.findById(quizId).select("_id title includedQuizIds");
    if (!quiz) {
      return res.status(404).json({ success: false, message: "Quiz not found" });
    }

    let deletedCount = 0;
    if (deleteAttempts) {
      const result = await QuizAttempt.deleteMany({ quizId });
      deletedCount = result.deletedCount || 0;
    }

    let carryOverRemoved = 0;
    if (clearCarryOver) {
      carryOverRemoved = (quiz.includedQuizIds || []).length;
      await Quiz.findByIdAndUpdate(quizId, { includedQuizIds: [] });
    }

    console.log(
      `[ClearQuizPoints] admin=${req.userId || "unknown"} quiz=${quizId} deletedAttempts=${deletedCount} carryOverRemoved=${carryOverRemoved}`
    );

    res.status(200).json({
      success: true,
      message: "Quiz leaderboard cleared successfully",
      data: { quizId, deletedCount, carryOverRemoved }
    });
  } catch (error) {
    console.error("[ClearQuizPoints] error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while clearing quiz leaderboard"
    });
  }
});

// POST /api/quiz-attempts/admin/clear-all - Permanently delete every quiz attempt
// (admin only). Writes a full NDJSON backup to disk BEFORE deleting anything,
// then streams that same file back as the response so the admin keeps a copy.
//
// Scope is quiz attempts only. Story puzzle and jigsaw stars are never touched.
router.post("/admin/clear-all", authenticateToken, async (req, res) => {
  try {
    const total = await QuizAttempt.countDocuments({});
    if (total === 0) {
      return res.status(200).json({
        success: true,
        message: "No quiz attempts to clear",
        data: { deletedCount: 0 }
      });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.resolve(__dirname, "../backups/quiz-attempt-clears");
    fs.mkdirSync(backupDir, { recursive: true });
    const filename = `quiz-attempts-backup-${stamp}.ndjson`;
    const filePath = path.join(backupDir, filename);

    // Write the backup and wait for the stream to flush and close. Nothing is
    // deleted until this resolves.
    const written = await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath, { encoding: "utf8" });
      let count = 0;

      writeStream.on("error", reject);

      (async () => {
        try {
          const cursor = QuizAttempt.find({}).lean().cursor();
          for await (const doc of cursor) {
            writeStream.write(`${JSON.stringify(doc)}\n`);
            count += 1;
          }
          writeStream.end(() => resolve(count));
        } catch (error) {
          reject(error);
        }
      })();
    });

    const result = await QuizAttempt.deleteMany({});

    console.log(
      `[QuizAttemptClearAll] admin=${req.userId || "unknown"} backedUp=${written} deleted=${result.deletedCount} file=${filePath}`
    );

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("X-Deleted-Count", String(result.deletedCount));
    res.setHeader("X-Backup-Count", String(written));
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("[QuizAttemptClearAll] error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while clearing quiz attempts"
    });
  }
});

module.exports = router;
