const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const { authenticateUser } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateUser);

// GET /api/goals - Get all goals for a user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        
        // Verify user is accessing their own goals
        if (userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }
        
        // Query parameters for filtering
        const { category, priority, completed, search } = req.query;
        
        // Build query
        const query = { userId };
        
        if (category) query.category = category;
        if (priority) query.priority = priority;
        if (completed !== undefined) query.completed = completed === 'true';
        
        // Find goals
        let goalsQuery = Goal.find(query);
        
        // Search functionality
        if (search) {
            goalsQuery = goalsQuery.where({
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            });
        }
        
        // Execute query with sorting
        const goals = await goalsQuery.sort({ createdAt: -1 });
        
        res.json(goals);
        
    } catch (error) {
        console.error('Error fetching goals:', error);
        res.status(500).json({
            error: 'Failed to fetch goals',
            details: error.message
        });
    }
});

// GET /api/goals/:id - Get single goal
router.get('/:id', async (req, res) => {
    try {
        const goal = await Goal.findById(req.params.id);
        
        if (!goal) {
            return res.status(404).json({
                error: 'Goal not found'
            });
        }
        
        // Verify ownership
        if (goal.userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }
        
        res.json(goal);
        
    } catch (error) {
        console.error('Error fetching goal:', error);
        res.status(500).json({
            error: 'Failed to fetch goal',
            details: error.message
        });
    }
});

// POST /api/goals - Create new goal
router.post('/', async (req, res) => {
    try {
        // Validate user ID matches
        if (req.body.userId !== req.user.uid) {
            return res.status(403).json({
                error: 'User ID mismatch'
            });
        }
        
        // Create new goal
        const goalData = {
            ...req.body,
            userId: req.user.uid // Ensure correct user ID
        };
        
        const goal = new Goal(goalData);
        
        // Validate before saving
        const validationError = goal.validateSync();
        if (validationError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: Object.values(validationError.errors).map(e => e.message)
            });
        }
        
        // Save goal
        const savedGoal = await goal.save();
        
        res.status(201).json(savedGoal);
        
    } catch (error) {
        console.error('Error creating goal:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Validation failed',
                details: Object.values(error.errors).map(e => e.message)
            });
        }
        
        res.status(500).json({
            error: 'Failed to create goal',
            details: error.message
        });
    }
});

// PUT /api/goals/:id - Update goal
router.put('/:id', async (req, res) => {
    try {
        // Find goal first to check ownership
        const goal = await Goal.findById(req.params.id);
        
        if (!goal) {
            return res.status(404).json({
                error: 'Goal not found'
            });
        }
        
        // Verify ownership
        if (goal.userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }
        
        // Update fields
        const allowedUpdates = [
            'title', 'description', 'category', 'priority', 
            'deadline', 'reminder', 'completed', 'progress',
            'tags', 'notes', 'subtasks'
        ];
        
        const updates = {};
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });
        
        // Handle completion status change
        if (updates.completed !== undefined) {
            if (updates.completed) {
                updates.completedAt = new Date();
                updates.progress = 100;
            } else {
                updates.completedAt = null;
            }
        }
        
        // Update goal
        const updatedGoal = await Goal.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { 
                new: true, // Return updated document
                runValidators: true // Run schema validators
            }
        );
        
        res.json(updatedGoal);
        
    } catch (error) {
        console.error('Error updating goal:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Validation failed',
                details: Object.values(error.errors).map(e => e.message)
            });
        }
        
        res.status(500).json({
            error: 'Failed to update goal',
            details: error.message
        });
    }
});

// DELETE /api/goals/:id - Delete goal
router.delete('/:id', async (req, res) => {
    try {
        // Find goal first to check ownership
        const goal = await Goal.findById(req.params.id);
        
        if (!goal) {
            return res.status(404).json({
                error: 'Goal not found'
            });
        }
        
        // Verify ownership
        if (goal.userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }
        
        // Delete goal
        await Goal.findByIdAndDelete(req.params.id);
        
        res.json({
            message: 'Goal deleted successfully',
            goal: goal
        });
        
    } catch (error) {
        console.error('Error deleting goal:', error);
        res.status(500).json({
            error: 'Failed to delete goal',
            details: error.message
        });
    }
});

// POST /api/goals/:id/subtasks - Add subtask
router.post('/:id/subtasks', async (req, res) => {
    try {
        const goal = await Goal.findById(req.params.id);
        
        if (!goal) {
            return res.status(404).json({
                error: 'Goal not found'
            });
        }
        
        if (goal.userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }
        
        const { title } = req.body;
        
        if (!title) {
            return res.status(400).json({
                error: 'Subtask title is required'
            });
        }
        
        await goal.addSubtask(title);
        
        res.json(goal);
        
    } catch (error) {
        console.error('Error adding subtask:', error);
        res.status(500).json({
            error: 'Failed to add subtask',
            details: error.message
        });
    }
});

// PUT /api/goals/:id/subtasks/:subtaskId - Toggle subtask
router.put('/:id/subtasks/:subtaskId', async (req, res) => {
    try {
        const goal = await Goal.findById(req.params.id);
        
        if (!goal) {
            return res.status(404).json({
                error: 'Goal not found'
            });
        }
        
        if (goal.userId !== req.user.uid) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }
        
        await goal.toggleSubtask(req.params.subtaskId);
        
        res.json(goal);
        
    } catch (error) {
        console.error('Error toggling subtask:', error);
        res.status(500).json({
            error: 'Failed to toggle subtask',
            details: error.message
        });
    }
});

// GET /api/goals/stats/overview - Get user statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Get basic stats
        const stats = await Goal.getStatsByUser(userId);
        
        // Get category stats
        const categoryStats = await Goal.getStatsByCategory(userId);
        
        // Get recent activity
        const recentGoals = await Goal.find({ userId })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select('title completed updatedAt');
        
        res.json({
            overview: stats,
            categories: categoryStats,
            recent: recentGoals
        });
        
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            error: 'Failed to fetch statistics',
            details: error.message
        });
    }
});

module.exports = router;
