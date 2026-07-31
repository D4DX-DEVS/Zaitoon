const express = require("express");
const QuizQuestion = require("../models/quizQuestion");
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();

// Helper function to normalize and validate input
const normalizeInput = (data) => {
  const normalized = {};
  
  if (data.type !== undefined) {
    normalized.type = String(data.type).trim();
  }
  
  if (data.question_en !== undefined) {
    normalized.question_en = String(data.question_en).trim();
  }
  
  if (data.question_ml !== undefined) {
    normalized.question_ml = String(data.question_ml).trim();
  }
  
  if (data.options_en !== undefined) {
    // Handle both string and array inputs
    if (Array.isArray(data.options_en)) {
      const trimmed = data.options_en
        .map(opt => String(opt).trim())
        .filter(opt => opt.length > 0);
      normalized.options_en = JSON.stringify(trimmed);
    } else if (typeof data.options_en === 'string') {
      try {
        const parsed = JSON.parse(data.options_en);
        if (Array.isArray(parsed)) {
          const trimmed = parsed
            .map(opt => String(opt).trim())
            .filter(opt => opt.length > 0);
          normalized.options_en = JSON.stringify(trimmed);
        } else {
          normalized.options_en = data.options_en.trim();
        }
      } catch (e) {
        normalized.options_en = data.options_en.trim();
      }
    } else {
      normalized.options_en = String(data.options_en).trim();
    }
  }
  
  if (data.options_ml !== undefined) {
    // Handle both string and array inputs
    if (Array.isArray(data.options_ml)) {
      const trimmed = data.options_ml
        .map(opt => String(opt).trim())
        .filter(opt => opt.length > 0);
      normalized.options_ml = JSON.stringify(trimmed);
    } else if (typeof data.options_ml === 'string') {
      try {
        const parsed = JSON.parse(data.options_ml);
        if (Array.isArray(parsed)) {
          const trimmed = parsed
            .map(opt => String(opt).trim())
            .filter(opt => opt.length > 0);
          normalized.options_ml = JSON.stringify(trimmed);
        } else {
          normalized.options_ml = data.options_ml.trim();
        }
      } catch (e) {
        normalized.options_ml = data.options_ml.trim();
      }
    } else {
      normalized.options_ml = String(data.options_ml).trim();
    }
  }
  
  if (data.correct_answer !== undefined) {
    normalized.correct_answer = parseInt(data.correct_answer, 10);
  }
  
  if (data.difficulty !== undefined) {
    normalized.difficulty = String(data.difficulty).trim();
  }
  
  return normalized;
};

// GET /api/quiz-questions - Get all quiz questions (admin only)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { page: pageQuery, limit: limitQuery, type, difficulty, search, quizConfigId } = req.query;
    
    const filter = {};
    
    if (type) {
      filter.type = { $regex: type.trim(), $options: "i" };
    }
    
    if (difficulty) {
      filter.difficulty = difficulty.trim();
    }

    if (quizConfigId) {
      filter.quizConfigId = quizConfigId;
    }
    
    if (search) {
      filter.$or = [
        { question_en: { $regex: search.trim(), $options: "i" } },
        { question_ml: { $regex: search.trim(), $options: "i" } }
      ];
    }

    const page = Math.max(1, parseInt(pageQuery, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(limitQuery, 10) || 20));
    const skip = (page - 1) * limit;

    const questions = await QuizQuestion.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await QuizQuestion.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: "Quiz questions retrieved successfully",
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
    console.error("Get quiz questions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quiz questions"
    });
  }
});

// GET /api/quiz-questions/:id - Get single quiz question by ID (admin only)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format"
      });
    }

    const question = await QuizQuestion.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Quiz question not found"
      });
    }

    const questionObj = question.toObject();

    res.status(200).json({
      success: true,
      message: "Quiz question retrieved successfully",
      data: questionObj
    });
  } catch (error) {
    console.error("Get quiz question error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quiz question"
    });
  }
});

// POST /api/quiz-questions - Create new quiz question (admin only)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      type,
      question_en,
      question_ml,
      options_en,
      options_ml,
      correct_answer,
      difficulty = "Medium",
      quizConfigId
    } = req.body;

    // Validate required fields
    if (!type || !question_en || !question_ml || !options_en || !options_ml || correct_answer === undefined) {
      return res.status(400).json({
        success: false,
        message: "Type, question_en, question_ml, options_en, options_ml, and correct_answer are required"
      });
    }

    // Normalize input
    const normalizedData = normalizeInput({
      type,
      question_en,
      question_ml,
      options_en,
      options_ml,
      correct_answer,
      difficulty
    });

    // Validate options are valid JSON arrays
    let optionsEnArray, optionsMlArray;
    try {
      optionsEnArray = JSON.parse(normalizedData.options_en);
      optionsMlArray = JSON.parse(normalizedData.options_ml);
      
      if (!Array.isArray(optionsEnArray) || optionsEnArray.length === 0) {
        return res.status(400).json({
          success: false,
          message: "options_en must be a non-empty array"
        });
      }
      
      if (!Array.isArray(optionsMlArray) || optionsMlArray.length === 0) {
        return res.status(400).json({
          success: false,
          message: "options_ml must be a non-empty array"
        });
      }
      
      // Validate that options_en and options_ml have the same length
      if (optionsEnArray.length !== optionsMlArray.length) {
        return res.status(400).json({
          success: false,
          message: "options_en and options_ml must have the same number of options"
        });
      }
      
      // Validate correct_answer is within bounds
      if (normalizedData.correct_answer < 0 || normalizedData.correct_answer >= optionsEnArray.length) {
        return res.status(400).json({
          success: false,
          message: `correct_answer must be between 0 and ${optionsEnArray.length - 1}`
        });
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid options format. Must be valid JSON arrays."
      });
    }

    // Validate difficulty
    if (!["Easy", "Medium", "Hard"].includes(normalizedData.difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be 'Easy', 'Medium', or 'Hard'"
      });
    }

    // Create new question
    const newQuestion = new QuizQuestion({
      ...normalizedData,
      ...(quizConfigId ? { quizConfigId } : {})
    });
    const savedQuestion = await newQuestion.save();
    const questionObj = savedQuestion.toObject();

    res.status(201).json({
      success: true,
      message: "Quiz question created successfully",
      data: questionObj
    });
  } catch (error) {
    console.error("Create quiz question error:", error);
    
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
      message: "Internal server error while creating quiz question"
    });
  }
});

// PUT /api/quiz-questions/:id - Update quiz question by ID (admin only)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format"
      });
    }

    const updateData = normalizeInput(req.body);
    if (req.body.quizConfigId !== undefined) {
      updateData.quizConfigId = req.body.quizConfigId || null;
    }

    // Validate options if provided
    if (updateData.options_en || updateData.options_ml) {
      const existing = await QuizQuestion.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Quiz question not found"
        });
      }

      let optionsEnArray, optionsMlArray;
      
      // Get options_en
      if (updateData.options_en) {
        try {
          optionsEnArray = JSON.parse(updateData.options_en);
          if (!Array.isArray(optionsEnArray) || optionsEnArray.length === 0) {
            return res.status(400).json({
              success: false,
              message: "options_en must be a non-empty array"
            });
          }
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid options_en format. Must be valid JSON array."
          });
        }
      } else {
        try {
          optionsEnArray = JSON.parse(existing.options_en);
        } catch (e) {
          optionsEnArray = [];
        }
      }
      
      // Get options_ml
      if (updateData.options_ml) {
        try {
          optionsMlArray = JSON.parse(updateData.options_ml);
          if (!Array.isArray(optionsMlArray) || optionsMlArray.length === 0) {
            return res.status(400).json({
              success: false,
              message: "options_ml must be a non-empty array"
            });
          }
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid options_ml format. Must be valid JSON array."
          });
        }
      } else {
        try {
          optionsMlArray = JSON.parse(existing.options_ml);
        } catch (e) {
          optionsMlArray = [];
        }
      }
      
      // Validate arrays have same length
      if (optionsEnArray.length !== optionsMlArray.length) {
        return res.status(400).json({
          success: false,
          message: "options_en and options_ml must have the same number of options"
        });
      }
      
      // Validate correct_answer if provided
      if (updateData.correct_answer !== undefined) {
        const correctAnswer = updateData.correct_answer;
        if (correctAnswer < 0 || correctAnswer >= optionsEnArray.length) {
          return res.status(400).json({
            success: false,
            message: `correct_answer must be between 0 and ${optionsEnArray.length - 1}`
          });
        }
      }
    } else if (updateData.correct_answer !== undefined) {
      // If only correct_answer is being updated, validate against existing options
      const existing = await QuizQuestion.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Quiz question not found"
        });
      }
      
      try {
        const optionsEnArray = JSON.parse(existing.options_en);
        if (updateData.correct_answer < 0 || updateData.correct_answer >= optionsEnArray.length) {
          return res.status(400).json({
            success: false,
            message: `correct_answer must be between 0 and ${optionsEnArray.length - 1}`
          });
        }
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid existing options format"
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

    const updatedQuestion = await QuizQuestion.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedQuestion) {
      return res.status(404).json({
        success: false,
        message: "Quiz question not found"
      });
    }

    const questionObj = updatedQuestion.toObject();

    res.status(200).json({
      success: true,
      message: "Quiz question updated successfully",
      data: questionObj
    });
  } catch (error) {
    console.error("Update quiz question error:", error);
    
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
      message: "Internal server error while updating quiz question"
    });
  }
});

// DELETE /api/quiz-questions/:id - Delete quiz question by ID (admin only)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid question ID format"
      });
    }

    const existing = await QuizQuestion.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Quiz question not found"
      });
    }

    await QuizQuestion.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Quiz question deleted successfully",
      data: {
        id: existing._id,
        question_en: existing.question_en
      }
    });
  } catch (error) {
    console.error("Delete quiz question error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting quiz question"
    });
  }
});

module.exports = router;
