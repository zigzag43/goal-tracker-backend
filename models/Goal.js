const mongoose = require("mongoose");

// Goal schema definition
const goalSchema = new mongoose.Schema(
  {
    // User who owns this goal
    userId: {
      type: String,
      required: [true, "User ID is required"],
      index: true, // Index for faster queries
    },

    // Goal title
    title: {
      type: String,
      required: [true, "Goal title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    // Goal description
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // Category
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: [
          "skill",
          "health",
          "career",
          "personal",
          "finance",
          "education",
        ],
        message: "{VALUE} is not a valid category",
      },
      default: "personal",
    },

    // Priority level
    priority: {
      type: String,
      required: true,
      enum: {
        values: ["low", "medium", "high"],
        message: "{VALUE} is not a valid priority",
      },
      default: "medium",
    },

    // Target deadline
    deadline: {
      type: Date,
      required: [true, "Deadline is required"],
      validate: {
        validator: function (value) {
          // Deadline should be in the future
          return value >= new Date();
        },
        message: "Deadline must be a future date",
      },
    },

    // Reminder setting
    reminder: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },

    // Completion status
    completed: {
      type: Boolean,
      default: false,
    },

    // Completion date
    completedAt: {
      type: Date,
      default: null,
    },

    // Progress percentage (0-100)
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Tags for better organization
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 20,
      },
    ],

    // Notes or additional details
    notes: {
      type: String,
      maxlength: 1000,
    },

    // Attachments or links
    attachments: [
      {
        name: String,
        url: String,
        type: String,
      },
    ],

    // Subtasks
    subtasks: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        completed: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Schema options
    timestamps: true, // Automatically manage createdAt and updatedAt
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
goalSchema.index({ userId: 1, createdAt: -1 });
goalSchema.index({ userId: 1, completed: 1 });
goalSchema.index({ userId: 1, category: 1 });
goalSchema.index({ userId: 1, deadline: 1 });

// Virtual for days remaining
goalSchema.virtual("daysRemaining").get(function () {
  if (this.completed) return 0;

  const today = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
});

// Virtual for overdue status
goalSchema.virtual("isOverdue").get(function () {
  if (this.completed) return false;

  return new Date() > new Date(this.deadline);
});

// Pre-save middleware
goalSchema.pre("save", function (next) {
  // Update the updatedAt timestamp
  this.updatedAt = Date.now();

  // If goal is marked as completed, set completedAt
  if (this.completed && !this.completedAt) {
    this.completedAt = Date.now();
  }
  // If goal is marked as incomplete, clear completedAt
  if (!this.completed && this.completedAt) {
    this.completedAt = null;
  }

  next();
});

// Instance methods
goalSchema.methods.markComplete = function () {
  this.completed = true;
  this.completedAt = new Date();
  this.progress = 100;
  return this.save();
};

goalSchema.methods.markIncomplete = function () {
  this.completed = false;
  this.completedAt = null;
  this.progress = 0;
  return this.save();
};

goalSchema.methods.updateProgress = function (progress) {
  this.progress = Math.min(100, Math.max(0, progress));
  if (this.progress === 100) {
    this.completed = true;
    this.completedAt = new Date();
  }
  return this.save();
};

goalSchema.methods.addSubtask = function (title) {
  this.subtasks.push({ title });
  return this.save();
};

goalSchema.methods.toggleSubtask = function (subtaskId) {
  const subtask = this.subtasks.id(subtaskId);
  if (subtask) {
    subtask.completed = !subtask.completed;

    // Update overall progress based on subtasks
    const completedSubtasks = this.subtasks.filter((st) => st.completed).length;
    const totalSubtasks = this.subtasks.length;

    if (totalSubtasks > 0) {
      this.progress = Math.round((completedSubtasks / totalSubtasks) * 100);
    }

    return this.save();
  }

  throw new Error("Subtask not found");
};

// Static methods
goalSchema.statics.findByUser = function (userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

goalSchema.statics.findActiveGoals = function (userId) {
  return this.find({ userId, completed: false }).sort({ deadline: 1 });
};

goalSchema.statics.findCompletedGoals = function (userId) {
  return this.find({ userId, completed: true }).sort({ completedAt: -1 });
};

goalSchema.statics.findOverdueGoals = function (userId) {
  const today = new Date();
  return this.find({
    userId,
    completed: false,
    deadline: { $lt: today },
  }).sort({ deadline: 1 });
};

goalSchema.statics.getStatsByUser = async function (userId) {
  const stats = await this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$completed", false] },
                  { $lt: ["$deadline", new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return stats[0] || { total: 0, completed: 0, overdue: 0 };
};

goalSchema.statics.getStatsByCategory = async function (userId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: "$category",
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$completed", true] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        category: "$_id",
        total: 1,
        completed: 1,
        percentage: {
          $round: [
            { $multiply: [{ $divide: ["$completed", "$total"] }, 100] },
            0,
          ],
        },
      },
    },
  ]);
};

// Create and export the model
const Goal = mongoose.model("Goal", goalSchema);

module.exports = Goal;
