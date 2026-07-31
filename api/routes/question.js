const express = require("express");
const Question = require("../models/question");
const { authenticateAdmin } = require("../middleware/auth");
const router = express.Router();

// GET /api/questions - Get all questions (admin only)
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const { page: pageQuery, limit: limitQuery, category, difficulty, search, sort, quizConfigId } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (quizConfigId) filter.quizConfigId = quizConfigId;
    if (search) {
      filter.$or = [
        { questionText: { $regex: search, $options: "i" } },
        { mlQuestionText: { $regex: search, $options: "i" } }
      ];
    }

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(1000, parseInt(limitQuery, 10) || 20));
    const skip = (page - 1) * limit;

    const sortOrder = sort === 'asc' ? { createdAt: 1 } : { createdAt: -1 };

    const questions = await Question.find(filter)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Question.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error("Get questions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching questions"
    });
  }
});

// GET /api/questions/:id - Get single question by ID (admin only)
router.get("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format"
      });
    }

    const question = await Question.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Question retrieved successfully",
      data: question
    });
  } catch (error) {
    console.error("Get question error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching question"
    });
  }
});

// POST /api/questions - Create new question (admin only)
router.post("/", authenticateAdmin, async (req, res) => {
  try {
    const {
      questionText,
      mlQuestionText,
      options,
      mlOptions,
      correctAnswer,
      points = 1,
      category,
      difficulty = "Medium",
      quizConfigId
    } = req.body;

    // Validate required fields
    if (!questionText || !mlQuestionText || !options || !mlOptions || correctAnswer === undefined) {
      return res.status(400).json({
        success: false,
        message: "Question text, Malayalam question text, options, and correct answer are required"
      });
    }

    // Validate options arrays
    if (options && (!Array.isArray(options) || options.length < 2 || options.length > 4)) {
      return res.status(400).json({
        success: false,
        message: "Options must be an array with 2 to 4 elements"
      });
    }

    if (mlOptions && (!Array.isArray(mlOptions) || mlOptions.length !== (options || []).length)) {
      return res.status(400).json({
        success: false,
        message: "Malayalam options must have the same number of elements as English options"
      });
    }

    // Validate correct answer index
    const optLen = options ? options.length : 4;
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= optLen) {
      return res.status(400).json({
        success: false,
        message: `Correct answer must be an integer between 0 and ${optLen - 1}`
      });
    }

    // Validate difficulty
    if (!["Easy", "Medium", "Hard"].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be 'Easy', 'Medium', or 'Hard'"
      });
    }

    const newQuestion = new Question({
      questionText,
      mlQuestionText,
      options,
      mlOptions,
      correctAnswer,
      points,
      category,
      difficulty,
      ...(quizConfigId ? { quizConfigId } : {})
    });

    const savedQuestion = await newQuestion.save();

    res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: savedQuestion
    });
  } catch (error) {
    console.error("Create question error:", error);
    
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
      message: "Internal server error while creating question"
    });
  }
});

// PUT /api/questions/:id - Update question by ID (admin only)
router.put("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format"
      });
    }

    // Validate options if provided
    if (updateData.options) {
      if (!Array.isArray(updateData.options) || updateData.options.length < 2 || updateData.options.length > 4) {
        return res.status(400).json({
          success: false,
          message: "Options must be an array with 2 to 4 elements"
        });
      }
    }

    if (updateData.mlOptions) {
      if (!Array.isArray(updateData.mlOptions) || updateData.mlOptions.length < 2 || updateData.mlOptions.length > 4) {
        return res.status(400).json({
          success: false,
          message: "Malayalam options must be an array with 2 to 4 elements"
        });
      }
      if (updateData.options && updateData.mlOptions.length !== updateData.options.length) {
        return res.status(400).json({
          success: false,
          message: "Malayalam options must have the same number of elements as English options"
        });
      }
    }

    // Validate correct answer if provided
    if (updateData.correctAnswer !== undefined) {
      const optCount = updateData.options ? updateData.options.length : 4;
      if (!Number.isInteger(updateData.correctAnswer) || updateData.correctAnswer < 0 || updateData.correctAnswer >= optCount) {
        return res.status(400).json({
          success: false,
          message: "Correct answer must be a valid option index"
        });
      }
    }

    // Validate difficulty if provided
    if (updateData.difficulty && !["Easy", "Medium", "Hard"].includes(updateData.difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be 'Easy', 'Medium', or 'Hard'"
      });
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedQuestion) {
      return res.status(404).json({
        success: false,
        message: "Question not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: updatedQuestion
    });
  } catch (error) {
    console.error("Update question error:", error);
    
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
      message: "Internal server error while updating question"
    });
  }
});

// DELETE /api/questions/:id - Delete question by ID (admin only)
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format"
      });
    }

    const existing = await Question.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Question not found"
      });
    }

    // Check if question is used in any quiz
    const Quiz = require("../models/quiz");
    const quizzesUsingQuestion = await Quiz.find({ questions: id });
    if (quizzesUsingQuestion.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete question. It is used in ${quizzesUsingQuestion.length} quiz/quizzes.`
      });
    }

    await Question.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
      data: {
        id: existing._id,
        questionText: existing.questionText
      }
    });
  } catch (error) {
    console.error("Delete question error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting question"
    });
  }
});

module.exports = router;
