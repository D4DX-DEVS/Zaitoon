const express = require("express");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const Quiz = require("../models/quiz");
const Question = require("../models/question");
const QuizAttempt = require("../models/quizAttempt");
const QuizConfig = require("../models/quizConfig");
const QuizQuestion = require("../models/quizQuestion");
const User = require("../models/user");
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();

// Start of "today" and "tomorrow" in given timezone (daily rollover at 12:00 AM in that zone).
function getTodayRange(tz) {
  const t = dayjs().tz(tz || "Asia/Kolkata");
  const startOfToday = t.startOf("day").toDate();
  const startOfTomorrow = t.add(1, "day").startOf("day").toDate();
  const endOfToday = t.endOf("day").toDate();
  return { startOfToday, startOfTomorrow, endOfToday };
}

console.log("Quiz routes file loaded - /stats route should be available at /api/quizzes/stats");

// GET /api/quizzes - Get all quizzes (public, but admin gets more details)
router.get("/", async (req, res) => {
  try {
    const { page: pageQuery, limit: limitQuery, status, date, configId } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (configId) filter.quizConfigId = configId;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.quizDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 20));
    const skip = (page - 1) * limit;

    const quizzes = await Quiz.find(filter)
      .populate("questions", "questionText mlQuestionText options mlOptions correctAnswer points")
      .sort({ quizDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Quiz.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Quizzes retrieved successfully",
      data: {
        quizzes,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error("Get quizzes error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quizzes"
    });
  }
});

// GET /api/quizzes/stats - Get leaderboard with statistics (public)
// Must be before /:id route to avoid route conflict
router.get("/stats", async (req, res) => {
  console.log("[STATS] Route hit - User ID:", req.userId);
  try {
    // Get current quiz configuration
    console.log("[STATS] Fetching quiz configuration...");
    const config = await QuizConfig.findOne();
    
    if (!config) {
      console.log("[STATS] No quiz configuration found - returning empty leaderboard");
      console.log("[STATS] Checking if any config exists...");
      const configCount = await QuizConfig.countDocuments();
      console.log("[STATS] Total configs in DB:", configCount);
      
      // Return empty leaderboard structure instead of 404
      return res.status(200).json({
        success: true,
        message: "Quiz statistics retrieved successfully",
        data: {
          totalUsersAttended: 0,
          quizConfig: {
            startDate: null,
            endDate: null,
            numberOfQuestions: null,
            questionsRandomization: false,
            isEnable: false,
            isLive: false
          },
          attendees: []
        }
      });
    }
    
    console.log("[STATS] Config found - ID:", config._id, "| Start:", config.startDate, "| End:", config.endDate);

    // Daily leaderboard: use "today" in config timezone (12:00 AM to 11:59:59 PM), not config start/end
    const { startOfToday, startOfTomorrow } = getTodayRange(config.timezone);
    console.log("[STATS] Daily leaderboard window (12:00 AM rollover):", startOfToday, "to", startOfTomorrow);
    const attempts = await QuizAttempt.find({
      createdAt: {
        $gte: startOfToday,
        $lt: startOfTomorrow
      }
    })
      .populate("userId", "name email class")
      .sort({ 
        score: -1,           // Highest score first
        totalDuration: 1,     // If tie, lowest duration (fastest) first
        createdAt: -1        // If tie, latest attempt first
      })
      .lean();

    console.log("[STATS] Found", attempts.length, "attempt(s) in date range");

    // Format attendees array (use userSnapshot when userId is null – e.g. Firebase users or anonymous)
    const attendees = attempts.map((attempt, index) => {
      const fromUser = attempt.userId && typeof attempt.userId === 'object' ? attempt.userId : null;
      const fromSnapshot = attempt.userSnapshot || {};
      return {
        rank: index + 1,
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

    console.log("[STATS] Sending response with", attendees.length, "attendees");
    res.status(200).json({
      success: true,
      message: "Quiz statistics retrieved successfully",
      data: {
        totalUsersAttended: attempts.length,
        quizConfig: {
          startDate: config.startDate,
          endDate: config.endDate,
          numberOfQuestions: config.numberOfQuestions,
          questionsRandomization: config.questionsRandomization,
          isEnable: config.isEnable,
          isLive: config.isLive
        },
        attendees
      }
    });
  } catch (error) {
    console.error("[STATS] ERROR:", error.message);
    console.error("[STATS] Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quiz statistics"
    });
  }
});

// POST /api/quizzes/attempt - Submit quiz attempt (no token required)
// Must be before /:id route to avoid route conflict
router.post("/attempt", async (req, res) => {
  try {
    const { language, questions, answers, name, email, class: userClass } = req.body;
    const userId = req.userId || null;
    const user = req.userDoc || null;
    const userSnapshot = user
      ? { name: user.name || "", email: user.email || "", class: user.class || "" }
      : { name: (name && String(name).trim()) || "", email: (email && String(email).trim().toLowerCase()) || "", class: (userClass && String(userClass).trim()) || "" };

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

    // When user is logged in, enforce one attempt per day (by config timezone)
    if (userId) {
      const configForDay = await QuizConfig.findOne();
      const { startOfToday, startOfTomorrow } = getTodayRange(configForDay?.timezone);

      const existingAttempt = await QuizAttempt.findOne({
        userId,
        createdAt: { $gte: startOfToday, $lt: startOfTomorrow }
      });
      if (existingAttempt) {
        return res.status(409).json({
          success: false,
          message: "You have already submitted today's quiz attempt. Only one attempt per day is allowed."
        });
      }
    }

    // Get quiz configuration
    console.log("[ATTEMPT] Fetching quiz configuration...");
    const config = await QuizConfig.findOne();
    if (!config) {
      console.error("[ATTEMPT] ERROR: Quiz configuration not found");
      const configCount = await QuizConfig.countDocuments();
      console.log("[ATTEMPT] Total configs in DB:", configCount);
      return res.status(503).json({
        success: false,
        message: "Quiz is currently unavailable. Please try again later."
      });
    }
    console.log("[ATTEMPT] Config found - Enabled:", config.isEnable, "| Questions:", config.numberOfQuestions);

    // Validate quiz is enabled
    if (!config.isEnable) {
      return res.status(503).json({
        success: false,
        message: "Quiz is currently disabled. Please contact administrator."
      });
    }

    // Validate current time is within startDate and endDate
    const now = new Date();
    console.log("[ATTEMPT] Time check - Now:", now, "| Start:", config.startDate, "| End:", config.endDate);
    if (now < config.startDate) {
      console.error("[ATTEMPT] ERROR: Quiz not started yet");
      return res.status(503).json({
        success: false,
        message: "Quiz has not started yet. Please check the quiz schedule."
      });
    }
    if (now > config.endDate) {
      console.error("[ATTEMPT] ERROR: Quiz has ended");
      return res.status(410).json({
        success: false,
        message: "Quiz has ended. The submission period is closed."
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
      console.error("[ATTEMPT] ERROR: Question count mismatch - Provided:", questions.length, "| Required:", config.numberOfQuestions);
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

    // Calculate percentage
    const percentage = questions.length > 0 
      ? Math.round((score / questions.length) * 100 * 100) / 100 
      : 0;

    console.log("[ATTEMPT] Score calculated - Score:", score, "/", questions.length, "| Percentage:", percentage + "%");

    // Create quiz attempt
    const quizAttempt = new QuizAttempt({
      userId,
      userSnapshot,
      language,
      questions: questionSnapshots,
      answers: processedAnswers,
      score,
      percentage,
      totalDuration
    });

    const savedAttempt = await quizAttempt.save();

    const populatedAttempt = await QuizAttempt.findById(savedAttempt._id)
      .populate("userId", "name email class")
      .lean();

    res.status(201).json({
      success: true,
      message: "Quiz attempt submitted successfully",
      data: populatedAttempt
    });
  } catch (error) {
    console.error("[ATTEMPT] ERROR:", error.message);
    console.error("[ATTEMPT] Error code:", error.code, "| Type:", error.name);
    if (error.stack) console.error("[ATTEMPT] Stack:", error.stack);
    
    // Handle duplicate attempt (unique constraint violation)
    if (error.code === 11000) {
      console.log("[ATTEMPT] Duplicate attempt detected (MongoDB unique constraint)");
      return res.status(409).json({
        success: false,
        message: "You have already submitted a quiz attempt. Only one attempt per user is allowed."
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => err.message);
      console.error("[ATTEMPT] Validation errors:", errors);
      return res.status(400).json({
        success: false,
        message: "Invalid quiz attempt data. Please check your submission.",
        errors: errors.length > 0 ? errors : ["Validation failed"]
      });
    }

    // Handle other errors
    console.error("[ATTEMPT] Unexpected error occurred");
    res.status(500).json({
      success: false,
      message: "Unable to submit quiz attempt. Please try again later."
    });
  }
});

// GET /api/quizzes/today - Get today's active quiz (public)
router.get("/today", async (req, res) => {
  try {
    const now = new Date();

    // Find the currently active quiz config (enabled and within date range)
    const config = await QuizConfig.findOne({
      isEnable: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ startDate: -1 }); // Prioritize most recently started config

    // Only run daily quiz when admin has configured a schedule
    if (!config || !config.startDate || !config.endDate) {
      return res.status(404).json({
        success: false,
        message: "Quiz is not available at this time"
      });
    }

    const { startOfToday, startOfTomorrow } = getTodayRange(config.timezone);

    // Try to find today's quiz first for this specific config
    let quiz = await Quiz.findOne({
      quizDate: { $gte: startOfToday, $lt: startOfTomorrow },
      quizConfigId: config._id,
      status: "Active"
    })
      .populate("questions", "questionText mlQuestionText options mlOptions points correctAnswer")
      .lean();

    // If no quiz exists for today, automatically create one using QuizConfig rules
    if (!quiz) {
      const pickSize = Math.max(1, parseInt(config.numberOfQuestions, 10) || 3);
      const useRandom = Boolean(config.questionsRandomization);

      // Get all already-used question ids for this specific config
      const usedQuestionIds = await Quiz.distinct("questions", {
        quizConfigId: config._id
      });

      // Pick questions from bank that have not been used before.
      // If questionsRandomization is ON: random pick. If OFF: deterministic pick by oldest created.
      let pickedQuestions = [];
      if (useRandom) {
        const pipeline = [
          { $match: { _id: { $nin: usedQuestionIds } } },
          { $sample: { size: pickSize } }
        ];
        pickedQuestions = await Question.aggregate(pipeline);
      } else {
        pickedQuestions = await Question.find({ _id: { $nin: usedQuestionIds } })
          .sort({ createdAt: 1 })
          .limit(pickSize)
          .select("_id")
          .lean();
      }

      if (!pickedQuestions || pickedQuestions.length < pickSize) {
        return res.status(400).json({
          success: false,
          message: "Not enough unused questions available to generate today's quiz"
        });
      }

      const questionIds = pickedQuestions.map(q => q._id);

      const newQuiz = new Quiz({
        title: `Daily Quiz ${dayjs(startOfToday).format("YYYY-MM-DD")}`,
        mlTitle: `Daily Quiz ${dayjs(startOfToday).format("YYYY-MM-DD")}`,
        description: "",
        mlDescription: "",
        quizDate: startOfToday,
        quizConfigId: config._id,
        questions: questionIds,
        status: "Active"
      });

      const savedQuiz = await newQuiz.save();

      quiz = await Quiz.findById(savedQuiz._id)
        .populate("questions", "questionText mlQuestionText options mlOptions points correctAnswer")
        .lean();
    }

    const publicQuiz = {
      ...quiz,
      questions: quiz.questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        mlQuestionText: q.mlQuestionText,
        options: q.options,
        mlOptions: q.mlOptions,
        points: q.points,
        correctAnswer: q.correctAnswer
      }))
    };

    res.status(200).json({
      success: true,
      message: "Today's quiz retrieved successfully",
      data: publicQuiz
    });
  } catch (error) {
    console.error("Get today's quiz error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching today's quiz"
    });
  }
});

// GET /api/quizzes/leaderboard/daily - Get daily leaderboard by date or date range (public, paginated)
// Accepts either ?date=YYYY-MM-DD (single day) or ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (range)
router.get("/leaderboard/daily", async (req, res) => {
  try {
    const { date, startDate, endDate, page: pageQuery, limit: limitQuery, search, configId } = req.query;

    let startOfDay, endOfDay;

    if (startDate && endDate) {
      // Date range mode
      const parsedStart = dayjs.tz(startDate, "Asia/Kolkata");
      const parsedEnd = dayjs.tz(endDate, "Asia/Kolkata");
      if (!parsedStart.isValid() || !parsedEnd.isValid()) {
        return res.status(400).json({ success: false, message: "Invalid startDate or endDate format. Expected YYYY-MM-DD" });
      }
      startOfDay = parsedStart.startOf("day").toDate();
      endOfDay = parsedEnd.add(1, "day").startOf("day").toDate();
    } else if (date) {
      // Single day mode (existing behaviour)
      const parsedDate = dayjs.tz(date, "Asia/Kolkata");
      if (!parsedDate.isValid()) {
        return res.status(400).json({ success: false, message: "Invalid date format. Expected YYYY-MM-DD" });
      }
      startOfDay = parsedDate.startOf("day").toDate();   // 12:00 AM IST
      endOfDay = parsedDate.add(1, "day").startOf("day").toDate(); // 12:00 AM IST next day
    } else {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'date' (YYYY-MM-DD) or 'startDate'+'endDate' is required"
      });
    }

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 10));

    // If configId is supplied, restrict to attempts from quizzes of that config.
    // Also include legacy attempts where quizId is null (submitted via old endpoint)
    // so they are not silently excluded from the count.
    const initialMatch = { createdAt: { $gte: startOfDay, $lt: endOfDay } };
    if (configId) {
      const quizIds = await Quiz.distinct("_id", { quizConfigId: configId });
      initialMatch.quizId = { $in: [null, ...quizIds] };
    }

    // Build aggregation pipeline for proper pagination with search
    const pipeline = [
      { $match: initialMatch },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "_user"
        }
      },
      { $unwind: { path: "$_user", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          _name: { $ifNull: ["$_user.name", { $ifNull: ["$userSnapshot.name", ""] }] },
          _email: { $ifNull: ["$_user.email", { $ifNull: ["$userSnapshot.email", ""] }] },
          _class: { $ifNull: ["$_user.class", { $ifNull: ["$userSnapshot.class", ""] }] },
          _phone: { $ifNull: ["$userSnapshot.phone", ""] }
        }
      }
    ];

    // Add search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      pipeline.push({
        $match: {
          $or: [
            { _name: searchRegex },
            { _email: searchRegex },
            { _phone: searchRegex }
          ]
        }
      });
    }

    pipeline.push({ $sort: { score: -1, totalDuration: 1, createdAt: -1 } });

    // Use $facet for count + paginated data in one query
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 1, userId: 1, score: 1, percentage: 1, totalDuration: 1,
              language: 1, createdAt: 1,
              _name: 1, _email: 1, _class: 1, _phone: 1
            }
          }
        ]
      }
    });

    const [result] = await QuizAttempt.aggregate(pipeline).allowDiskUse(true);
    const total = result.metadata[0]?.total || 0;
    const skip = (page - 1) * limit;

    const attendees = result.data.map((attempt, index) => ({
      rank: skip + index + 1,
      attemptId: attempt._id,
      userId: attempt.userId,
      userName: attempt._name,
      userEmail: attempt._email,
      userClass: attempt._class,
      userPhone: attempt._phone,
      score: attempt.score,
      percentage: attempt.percentage,
      totalDuration: attempt.totalDuration,
      language: attempt.language,
      createdAt: attempt.createdAt
    }));

    res.status(200).json({
      success: true,
      message: "Daily leaderboard retrieved successfully",
      data: {
        dateFrom: startOfDay,
        dateTo: endOfDay,
        totalUsersAttended: total,
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
    console.error("Get daily leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching daily leaderboard"
    });
  }
});

// GET /api/quizzes/leaderboard/total - Get total leaderboard for a date range (public, paginated)
router.get("/leaderboard/total", async (req, res) => {
  try {
    const { startDate, endDate, page: pageQuery, limit: limitQuery, search } = req.query;

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 10));

    const match = {};

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate format. Expected YYYY-MM-DD"
          });
        }
        start.setHours(0, 0, 0, 0);
        match.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate format. Expected YYYY-MM-DD"
          });
        }
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    const pipeline = [
      Object.keys(match).length ? { $match: match } : null,
      {
        $group: {
          _id: "$userId",
          totalScore: { $sum: "$score" },
          totalDuration: { $sum: "$totalDuration" },
          attemptsCount: { $sum: 1 },
          snapshotName: { $first: "$userSnapshot.name" },
          snapshotEmail: { $first: "$userSnapshot.email" },
          snapshotClass: { $first: "$userSnapshot.class" },
          snapshotPhone: { $first: "$userSnapshot.phone" }
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "_userDoc"
        }
      },
      { $unwind: { path: "$_userDoc", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          _name: { $ifNull: ["$_userDoc.name", { $ifNull: ["$snapshotName", ""] }] },
          _email: { $ifNull: ["$_userDoc.email", { $ifNull: ["$snapshotEmail", ""] }] },
          _class: { $ifNull: ["$_userDoc.class", { $ifNull: ["$snapshotClass", ""] }] },
          _phone: { $ifNull: ["$snapshotPhone", ""] }
        }
      }
    ].filter(Boolean);

    // Add search filter after grouping
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      pipeline.push({
        $match: {
          $or: [
            { _name: searchRegex },
            { _email: searchRegex },
            { _phone: searchRegex }
          ]
        }
      });
    }

    pipeline.push({ $sort: { totalScore: -1, totalDuration: 1 } });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ]
      }
    });

    const [result] = await QuizAttempt.aggregate(pipeline).allowDiskUse(true);
    const total = result.metadata[0]?.total || 0;
    const skip = (page - 1) * limit;

    const leaderboard = result.data.map((item, index) => ({
      rank: skip + index + 1,
      userId: item._id,
      userName: item._name,
      userEmail: item._email,
      userClass: item._class,
      userPhone: item._phone,
      totalScore: item.totalScore,
      totalDuration: item.totalDuration,
      attemptsCount: item.attemptsCount
    }));

    res.status(200).json({
      success: true,
      message: "Total leaderboard retrieved successfully",
      data: {
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        totalUsers: total,
        leaderboard,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("Get total leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching total leaderboard"
    });
  }
});

// GET /api/quizzes/leaderboard/by-email - Leaderboard grouped by email (paginated, searchable)
router.get("/leaderboard/by-email", async (req, res) => {
  try {
    const { startDate, endDate, page: pageQuery, limit: limitQuery, search, configId } = req.query;

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 10));

    const match = {};

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate format. Expected YYYY-MM-DD"
          });
        }
        start.setHours(0, 0, 0, 0);
        match.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate format. Expected YYYY-MM-DD"
          });
        }
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    // If configId is supplied, restrict to attempts from quizzes of that config.
    // Include null-quizId (legacy) attempts so they are not dropped from the count.
    if (configId) {
      const quizIds = await Quiz.distinct("_id", { quizConfigId: configId });
      match.quizId = { $in: [null, ...quizIds] };
    }

    const emailKey = { $toLower: { $ifNull: ["$emailNormalized", "$userSnapshot.email"] } };

    const pipeline = [
      Object.keys(match).length ? { $match: match } : null,
      { $addFields: { _emailKey: emailKey } },
      { $match: { _emailKey: { $ne: "" } } },
      {
        $group: {
          _id: "$_emailKey",
          totalScore: { $sum: "$score" },
          totalDuration: { $sum: "$totalDuration" },
          attemptsCount: { $sum: 1 },
          userName: { $first: "$userSnapshot.name" },
          userClass: { $first: "$userSnapshot.class" },
          userPhone: { $first: "$userSnapshot.phone" }
        }
      }
    ].filter(Boolean);

    // Add search filter after grouping
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      pipeline.push({
        $match: {
          $or: [
            { userName: searchRegex },
            { _id: searchRegex },
            { userPhone: searchRegex }
          ]
        }
      });
    }

    pipeline.push({ $sort: { totalScore: -1, totalDuration: 1 } });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ]
      }
    });

    const [result] = await QuizAttempt.aggregate(pipeline).allowDiskUse(true);
    const total = result.metadata[0]?.total || 0;
    const skip = (page - 1) * limit;

    const leaderboard = result.data.map((item, index) => ({
      rank: skip + index + 1,
      email: item._id,
      userName: item.userName || "",
      userClass: item.userClass || "",
      userPhone: item.userPhone || "",
      totalScore: item.totalScore,
      totalDuration: item.totalDuration,
      attemptsCount: item.attemptsCount
    }));

    res.status(200).json({
      success: true,
      message: "Leaderboard by email retrieved successfully",
      data: {
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        totalUsers: total,
        leaderboard,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("Get leaderboard by email error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching leaderboard by email"
    });
  }
});

// POST /api/quizzes/:quizId/attempt - Submit attempt for a quiz (no token required)
// User sends only answers; server calculates score from DB
// MUST be before /:id route to avoid route conflict
router.post("/:quizId/attempt", async (req, res) => {
  try {
    const { quizId } = req.params;
    const { language, answers, name, email, class: userClass, phone } = req.body;
    const userId = req.userId || null;
    const user = req.userDoc || null;
    const phoneFromBody = (phone && String(phone).trim()) || "";
    const userSnapshot = user
      ? { name: user.name || "", email: user.email || "", class: user.class || "", phone: (user.phone && String(user.phone).trim()) || phoneFromBody }
      : { name: (name && String(name).trim()) || "", email: (email && String(email).trim().toLowerCase()) || "", class: (userClass && String(userClass).trim()) || "", phone: phoneFromBody };

    const emailNormalized = (userSnapshot.email || "").trim().toLowerCase();
    if (!emailNormalized) {
      return res.status(400).json({ success: false, message: "Email is required for quiz submission." });
    }
    const phoneTrimmed = (userSnapshot.phone || "").trim();
    if (!phoneTrimmed) {
      return res.status(400).json({ success: false, message: "Phone number is required for quiz submission." });
    }

    // One attempt per email per day (any quiz), by config timezone
    const configForDay = await QuizConfig.findOne();
    const { startOfToday, startOfTomorrow } = getTodayRange(configForDay?.timezone);
    const alreadyAttemptedToday = await QuizAttempt.findOne({
      $or: [
        { emailNormalized },
        { "userSnapshot.email": emailNormalized }
      ],
      createdAt: { $gte: startOfToday, $lt: startOfTomorrow }
    });
    if (alreadyAttemptedToday) {
      return res.status(409).json({
        success: false,
        message: "You have already attempted today. Come back tomorrow!"
      });
    }

    if (!quizId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid quiz ID format" });
    }

    if (!language || !["en", "ml"].includes(language)) {
      return res.status(400).json({ success: false, message: "Language must be 'en' or 'ml'" });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ success: false, message: "Answers must be a non-empty array" });
    }

    const config = await QuizConfig.findOne();
    if (!config || !config.startDate || !config.endDate) {
      return res.status(503).json({ success: false, message: "Quiz is currently unavailable. Please try again later." });
    }
    if (!config.isEnable) {
      return res.status(503).json({ success: false, message: "Quiz is currently disabled. Please contact administrator." });
    }
    const now = new Date();
    if (now < config.startDate) {
      return res.status(503).json({ success: false, message: "Quiz has not started yet. Please check the quiz schedule." });
    }
    if (now > config.endDate) {
      return res.status(410).json({ success: false, message: "Quiz has ended. The submission period is closed." });
    }

    const quiz = await Quiz.findById(quizId)
      .populate("questions", "questionText mlQuestionText options mlOptions correctAnswer points difficulty")
      .lean();

    if (!quiz || quiz.status !== "Active") {
      return res.status(404).json({ success: false, message: "Quiz not found or inactive" });
    }

    // When user is logged in, prevent multiple attempts for same quiz
    if (userId) {
      const existingAttemptForQuiz = await QuizAttempt.findOne({ userId, quizId });
      if (existingAttemptForQuiz) {
        return res.status(409).json({
          success: false,
          message: "You have already submitted an attempt for this quiz."
        });
      }
    }

    // answers expected: [{ questionId, attemptedAnswer, duration }]
    const answerMap = new Map();
    for (const a of answers) {
      if (!a || !a.questionId || a.attemptedAnswer === undefined || a.duration === undefined) {
        return res.status(400).json({
          success: false,
          message: "Each answer must include questionId, attemptedAnswer, and duration"
        });
      }
      answerMap.set(String(a.questionId), a);
    }

    const questionSnapshots = [];
    const processedAnswers = [];
    let totalDuration = 0;
    let score = 0;

    for (const q of quiz.questions || []) {
      const qid = String(q._id);
      const a = answerMap.get(qid);
      if (!a) {
        return res.status(400).json({
          success: false,
          message: `Missing answer for questionId ${qid}`
        });
      }

      const attemptedAnswer = parseInt(a.attemptedAnswer, 10);
      const duration = parseFloat(a.duration);

      if (isNaN(attemptedAnswer) || attemptedAnswer < 0) {
        return res.status(400).json({ success: false, message: `Invalid attemptedAnswer for questionId ${qid}` });
      }
      if (isNaN(duration) || duration < 0) {
        return res.status(400).json({ success: false, message: `Invalid duration for questionId ${qid}` });
      }

      const correct = q.correctAnswer;
      const isCorrect = attemptedAnswer === correct;
      if (isCorrect) score += 1;
      totalDuration += duration;

      // Snapshot (compatible with existing QuizAttempt schema format)
      questionSnapshots.push({
        _id: qid,
        type: "mcq",
        question_en: String(q.questionText || "").trim(),
        question_ml: String(q.mlQuestionText || "").trim(),
        options_en: JSON.stringify(q.options || []),
        options_ml: JSON.stringify(q.mlOptions || []),
        correct_answer: correct,
        difficulty: String(q.difficulty || "Medium")
      });

      processedAnswers.push({ attemptedAnswer, isCorrect, duration });
    }

    const percentage = quiz.questions?.length
      ? Math.round((score / quiz.questions.length) * 100 * 100) / 100
      : 0;

    const attempt = await new QuizAttempt({
      quizId,
      userId,
      userSnapshot,
      emailNormalized,
      language,
      questions: questionSnapshots,
      answers: processedAnswers,
      score,
      percentage,
      totalDuration
    }).save();

    const populated = await QuizAttempt.findById(attempt._id)
      .populate("userId", "name email class")
      .populate("quizId", "title mlTitle quizDate status")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Quiz attempt submitted successfully",
      data: populated
    });
  } catch (error) {
    console.error("Submit quiz attempt by quizId error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error code:", error.code);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    if (error.code === 11000) {
      if (req.userId) {
        try {
          const existingAttempt = await QuizAttempt.findOne({ userId: req.userId, quizId: req.params.quizId });
          if (existingAttempt) {
            return res.status(409).json({
              success: false,
              message: "You have already submitted an attempt for this quiz."
            });
          }
        } catch (checkError) {
          console.error("Error checking existing attempt:", checkError);
        }
      }
      return res.status(500).json({
        success: false,
        message: "Database index conflict. Please contact administrator to drop old 'quiz_1_user_1' index.",
        error: error.message
      });
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Unable to submit quiz attempt. Please try again later.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/quizzes/:id - Get single quiz by ID (public, but admin gets answers)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format"
      });
    }

    const quiz = await Quiz.findById(id)
      .populate("questions")
      .lean();

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    // Check if admin (for showing correct answers)
    const authHeader = req.header("Authorization");
    const isAdmin = authHeader && authHeader.startsWith("Bearer ");

    // Remove correct answers for non-admin users
    if (!isAdmin) {
      quiz.questions = quiz.questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        mlQuestionText: q.mlQuestionText,
        options: q.options,
        mlOptions: q.mlOptions,
        points: q.points
      }));
    }

    res.status(200).json({
      success: true,
      message: "Quiz retrieved successfully",
      data: quiz
    });
  } catch (error) {
    console.error("Get quiz error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quiz"
    });
  }
});

// POST /api/quizzes - Create new quiz (admin only)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      mlTitle,
      description,
      mlDescription,
      quizDate,
      questions,
      status = "Active",
      quizConfigId
    } = req.body;

    // Validate required fields
    if (!title || !mlTitle || !quizDate || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Title, Malayalam title, quiz date, and at least one question are required"
      });
    }

    // Validate questions exist
    const questionDocs = await Question.find({ _id: { $in: questions } });
    if (questionDocs.length !== questions.length) {
      return res.status(400).json({
        success: false,
        message: "One or more questions not found"
      });
    }

    // Validate quiz date is unique (scoped per config if provided)
    const date = new Date(quizDate);
    date.setHours(0, 0, 0, 0);
    const dateFilter = { quizDate: date };
    if (quizConfigId) dateFilter.quizConfigId = quizConfigId;
    const existingQuiz = await Quiz.findOne(dateFilter);
    if (existingQuiz) {
      return res.status(400).json({
        success: false,
        message: "A quiz already exists for this date"
      });
    }

    // Validate status
    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'Active' or 'Inactive'"
      });
    }

    const newQuiz = new Quiz({
      title,
      mlTitle,
      description,
      mlDescription,
      quizDate: date,
      questions,
      status,
      ...(quizConfigId ? { quizConfigId } : {})
    });

    const savedQuiz = await newQuiz.save();
    const populatedQuiz = await Quiz.findById(savedQuiz._id)
      .populate("questions");

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: populatedQuiz
    });
  } catch (error) {
    console.error("Create quiz error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A quiz already exists for this date"
      });
    }

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
      message: "Internal server error while creating quiz"
    });
  }
});

// PUT /api/quizzes/:id - Update quiz by ID (admin only)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format"
      });
    }

    // Handle quiz date update
    if (updateData.quizDate) {
      const date = new Date(updateData.quizDate);
      date.setHours(0, 0, 0, 0);
      updateData.quizDate = date;

      // Check if another quiz exists for this date (per config if applicable)
      const dateFilter = { quizDate: date, _id: { $ne: id } };
      if (updateData.quizConfigId) dateFilter.quizConfigId = updateData.quizConfigId;
      const existingQuiz = await Quiz.findOne(dateFilter);
      if (existingQuiz) {
        return res.status(400).json({
          success: false,
          message: "A quiz already exists for this date"
        });
      }
    }

    // Validate questions if provided
    if (updateData.questions) {
      if (!Array.isArray(updateData.questions) || updateData.questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Questions must be a non-empty array"
        });
      }

      const questionDocs = await Question.find({ _id: { $in: updateData.questions } });
      if (questionDocs.length !== updateData.questions.length) {
        return res.status(400).json({
          success: false,
          message: "One or more questions not found"
        });
      }
    }

    // Validate status if provided
    if (updateData.status && !["Active", "Inactive"].includes(updateData.status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'Active' or 'Inactive'"
      });
    }

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("questions");

    if (!updatedQuiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Quiz updated successfully",
      data: updatedQuiz
    });
  } catch (error) {
    console.error("Update quiz error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A quiz already exists for this date"
      });
    }

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
      message: "Internal server error while updating quiz"
    });
  }
});

// DELETE /api/quizzes/:id - Delete quiz by ID (admin only)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quiz ID format"
      });
    }

    const existing = await Quiz.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found"
      });
    }

    // Check if there are any attempts for this quiz
    const attemptsCount = await QuizAttempt.countDocuments({ quiz: id });
    if (attemptsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete quiz. ${attemptsCount} attempt(s) exist for this quiz.`
      });
    }

    await Quiz.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Quiz deleted successfully",
      data: {
        id: existing._id,
        title: existing.title
      }
    });
  } catch (error) {
    console.error("Delete quiz error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting quiz"
    });
  }
});

module.exports = router;
