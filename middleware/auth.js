const admin = require('firebase-admin');

// Firebase Admin SDK initialization (optional - advanced security ke liye)
// Agar simple rakhna chahte ho to skip kar sakte ho
let firebaseAdmin;
try {
    if (process.env.FIREBASE_PROJECT_ID) {
        firebaseAdmin = admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('Firebase Admin SDK initialized');
    }
} catch (error) {
    console.log('Firebase Admin SDK not initialized:', error.message);
}

// Simple auth middleware - Firebase token verify karta hai
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No token provided'
            });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Agar Firebase Admin SDK available hai to use karo
        if (firebaseAdmin) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token);
                req.user = {
                    uid: decodedToken.uid,
                    email: decodedToken.email
                };
                next();
            } catch (error) {
                console.error('Firebase token verification failed:', error);
                return res.status(401).json({
                    error: 'Invalid token'
                });
            }
        } else {
            // Simple validation - production me Firebase Admin SDK use karna better hai
            // Ye sirf development ke liye hai
            if (token && token.length > 20) {
                // Mock user for development
                req.user = {
                    uid: 'dev-user-id',
                    email: 'dev@example.com'
                };
                next();
            } else {
                return res.status(401).json({
                    error: 'Invalid token format'
                });
            }
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Authentication failed'
        });
    }
};

// Optional auth middleware - login optional hai
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            if (firebaseAdmin) {
                try {
                    const decodedToken = await admin.auth().verifyIdToken(token);
                    req.user = {
                        uid: decodedToken.uid,
                        email: decodedToken.email
                    };
                } catch (error) {
                    // Token invalid hai but request continue karo
                    req.user = null;
                }
            } else {
                // Development mode
                req.user = {
                    uid: 'dev-user-id',
                    email: 'dev@example.com'
                };
            }
        } else {
            req.user = null;
        }
        
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

// Admin check (future use ke liye)
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required'
        });
    }
    
    // Check if user is admin (implement your logic)
    // For now, simple check
    if (req.user.email && req.user.email.includes('admin')) {
        next();
    } else {
        return res.status(403).json({
            error: 'Admin access required'
        });
    }
};

module.exports = {
    authenticateUser,
    optionalAuth,
    requireAdmin
};
