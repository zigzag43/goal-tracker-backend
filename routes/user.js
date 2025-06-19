const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateUser } = require('../middleware/auth');

// POST /api/user/initialize - Initialize new user
router.post('/initialize', authenticateUser, async (req, res) => {
    try {
        const { uid, email } = req.body;
        
        // Check if user already exists
        let user = await User.findByFirebaseUid(uid);
        
        if (user) {
            // Update last login
            user.lastLogin = new Date();
            await user.save();
            
            return res.json({
                message: 'User already exists',
                user: user
            });
        }
        
        // Create new user
        user = await User.createFromFirebase({
            uid: uid,
            email: email
        });
        
        res.status(201).json({
            message: 'User created successfully',
            user: user
        });
        
    } catch (error) {
        console.error('Error initializing user:', error);
        res.status(500).json({
            error: 'Failed to initialize user',
            details: error.message
        });
    }
});

// GET /api/user/profile - Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
    try {
        const user = await User.findByFirebaseUid(req.user.uid);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        res.json(user);
        
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({
            error: 'Failed to fetch profile',
            details: error.message
        });
    }
});

// PUT /api/user/profile - Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
    try {
        const user = await User.findByFirebaseUid(req.user.uid);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        // Update allowed fields
        const allowedUpdates = ['profile', 'preferences'];
        
        allowedUpdates.forEach(field => {
            if (req.body[field]) {
                Object.assign(user[field], req.body[field]);
            }
        });
        
        await user.save();
        
        res.json({
            message: 'Profile updated successfully',
            user: user
        });
        
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            error: 'Failed to update profile',
            details: error.message
        });
    }
});

// POST /api/user/update-streak - Update user streak
router.post('/update-streak', authenticateUser, async (req, res) => {
    try {
        const user = await User.findByFirebaseUid(req.user.uid);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        await user.updateStreak();
        
        res.json({
            message: 'Streak updated',
            streak: user.stats.streak
        });
        
    } catch (error) {
        console.error('Error updating streak:', error);
        res.status(500).json({
            error: 'Failed to update streak',
            details: error.message
        });
    }
});

// DELETE /api/user/account - Delete user account
router.delete('/account', authenticateUser, async (req, res) => {
    try {
        const user = await User.findByFirebaseUid(req.user.uid);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        
        // Soft delete - just mark as deleted
        user.status = 'deleted';
        await user.save();
        
        // Optionally delete all user's goals
        const Goal = require('../models/Goal');
        await Goal.deleteMany({ userId: req.user.uid });
        
        res.json({
            message: 'Account deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({
            error: 'Failed to delete account',
            details: error.message
        });
    }
});

module.exports = router;
