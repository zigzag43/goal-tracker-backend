const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User schema (optional - agar Firebase use karte ho to simple rakho)
const userSchema = new mongoose.Schema({
    // Firebase UID
    firebaseUid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // User email
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    
    // User profile
    profile: {
        displayName: {
            type: String,
            trim: true
        },
        photoURL: {
            type: String
        },
        bio: {
            type: String,
            maxlength: 500
        }
    },
    
    // User preferences
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'light'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            push: {
                type: Boolean,
                default: true
            },
            reminders: {
                type: Boolean,
                default: true
            }
        },
        timezone: {
            type: String,
            default: 'UTC'
        },
        language: {
            type: String,
            default: 'en'
        }
    },
    
    // Statistics
    stats: {
        totalGoals: {
            type: Number,
            default: 0
        },
        completedGoals: {
            type: Number,
            default: 0
        },
        streak: {
            current: {
                type: Number,
                default: 0
            },
            longest: {
                type: Number,
                default: 0
            },
            lastActiveDate: Date
        }
    },
    
    // Subscription/Plan (for future use)
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'pro', 'premium'],
            default: 'free'
        },
        validUntil: Date,
        features: {
            maxGoals: {
                type: Number,
                default: 50
            },
            advancedStats: {
                type: Boolean,
                default: false
            },
            unlimitedReminders: {
                type: Boolean,
                default: false
            }
        }
    },
    
    // Account status
    status: {
        type: String,
        enum: ['active', 'suspended', 'deleted'],
        default: 'active'
    },
    
    // Last login
    lastLogin: {
        type: Date,
        default: Date.now
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'stats.totalGoals': -1 });

// Instance methods
userSchema.methods.updateStats = async function() {
    const Goal = mongoose.model('Goal');
    
    const stats = await Goal.getStatsByUser(this.firebaseUid);
    
    this.stats.totalGoals = stats.total;
    this.stats.completedGoals = stats.completed;
    
    return this.save();
};

userSchema.methods.updateStreak = function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (this.stats.streak.lastActiveDate) {
        const lastActive = new Date(this.stats.streak.lastActiveDate);
        lastActive.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
            // Continue streak
            this.stats.streak.current++;
            
            if (this.stats.streak.current > this.stats.streak.longest) {
                this.stats.streak.longest = this.stats.streak.current;
            }
        } else if (daysDiff > 1) {
            // Streak broken
            this.stats.streak.current = 1;
        }
        // If daysDiff === 0, user already active today, no change
    } else {
        // First activity
        this.stats.streak.current = 1;
        this.stats.streak.longest = 1;
    }
    
    this.stats.streak.lastActiveDate = today;
    return this.save();
};

// Static methods
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
    return this.findOne({ firebaseUid });
};

userSchema.statics.createFromFirebase = function(firebaseUser) {
    return this.create({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        profile: {
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL
        }
    });
};

// Create and export the model
const User = mongoose.model('User', userSchema);

module.exports = User;
