const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const { authenticateUser } = require('../middleware/auth');

// Apply authentication
router.use(authenticateUser);

// GET /api/stats/dashboard - Get dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Basic statistics
        const totalGoals = await Goal.countDocuments({ userId });
        const completedGoals = await Goal.countDocuments({ userId, completed: true });
        const activeGoals = await Goal.countDocuments({ userId, completed: false });
        
        // Calculate completion rate
        const completionRate = totalGoals > 0 
            ? Math.round((completedGoals / totalGoals) * 100) 
            : 0;
        
        // Get overdue goals
        const today = new Date();
        const overdueGoals = await Goal.countDocuments({
            userId,
            completed: false,
            deadline: { $lt: today }
        });
        
        // Goals by priority
        const priorityStats = await Goal.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 },
                    completed: {
                        $sum: { $cond: ['$completed', 1, 0] }
                    }
                }
            }
        ]);
        
        // Goals by category
        const categoryStats = await Goal.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    completed: {
                        $sum: { $cond: ['$completed', 1, 0] }
                    }
                }
            }
        ]);
        
        // Recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentActivity = await Goal.aggregate([
            {
                $match: {
                    userId,
                    updatedAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$updatedAt'
                        }
                    },
                    created: {
                        $sum: {
                            $cond: [
                                { $eq: ['$createdAt', '$updatedAt'] },
                                1,
                                0
                            ]
                        }
                    },
                    completed: {
                        $sum: {
                            $cond: ['$completed', 1, 0]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        res.json({
            summary: {
                total: totalGoals,
                completed: completedGoals,
                active: activeGoals,
                overdue: overdueGoals,
                completionRate
            },
            byPriority: priorityStats,
            byCategory: categoryStats,
            recentActivity
        });
        
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            error: 'Failed to fetch statistics',
            details: error.message
        });
    }
});

// GET /api/stats/progress - Get progress over time
router.get('/progress', async (req, res) => {
    try {
        const userId = req.user.uid;
        const { period = '30d' } = req.query;
        
        // Calculate date range
        let startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }
        
        // Get progress data
        const progressData = await Goal.aggregate([
            {
                $match: {
                    userId,
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    created: { $sum: 1 },
                    completed: {
                        $sum: { $cond: ['$completed', 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        // Calculate cumulative progress
        let cumulativeTotal = 0;
        let cumulativeCompleted = 0;
        
        const cumulativeProgress = progressData.map(day => {
            cumulativeTotal += day.created;
            cumulativeCompleted += day.completed;
            
            return {
                date: day._id,
                total: cumulativeTotal,
                completed: cumulativeCompleted,
                completionRate: cumulativeTotal > 0 
                    ? Math.round((cumulativeCompleted / cumulativeTotal) * 100)
                    : 0
            };
        });
        
        res.json({
            period,
            progress: cumulativeProgress
        });
        
    } catch (error) {
        console.error('Error fetching progress stats:', error);
        res.status(500).json({
            error: 'Failed to fetch progress data',
            details: error.message
        });
    }
});

// GET /api/stats/achievements - Get user achievements
router.get('/achievements', async (req, res) => {
    try {
        const userId = req.user.uid;
        
        const stats = await Goal.getStatsByUser(userId);
        
        // Define achievements
        const achievements = [
            {
                id: 'first_goal',
                name: 'First Step',
                description: 'Create your first goal',
                icon: '🎯',
                unlocked: stats.total >= 1
            },
            {
                id: 'first_completion',
                name: 'Goal Getter',
                description: 'Complete your first goal',
                icon: '✅',
                unlocked: stats.completed >= 1
            },
            {
                id: 'ten_goals',
                name: 'Ambitious',
                description: 'Create 10 goals',
                icon: '🚀',
                unlocked: stats.total >= 10
            },
            {
                id: 'ten_completions',
                name: 'Achiever',
                description: 'Complete 10 goals',
                icon: '🏆',
                unlocked: stats.completed >= 10
            },
            {
                id: 'perfect_week',
                name: 'Perfect Week',
                description: 'Complete all goals in a week',
                icon: '💯',
                unlocked: false // TODO: Implement logic
            },
            {
                id: 'streak_7',
                name: 'Consistent',
                description: 'Maintain a 7-day streak',
                icon: '🔥',
                unlocked: false // TODO: Implement with User model
            }
        ];
        
        const unlockedCount = achievements.filter(a => a.unlocked).length;
        
        res.json({
            achievements,
            summary: {
                total: achievements.length,
                unlocked: unlockedCount,
                percentage: Math.round((unlockedCount / achievements.length) * 100)
            }
        });
        
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({
            error: 'Failed to fetch achievements',
            details: error.message
        });
    }
});

module.exports = router;
