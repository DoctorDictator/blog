const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../../models/User');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: function (req, file, cb) {
        // Generate a 10-digit unique number
        const uniqueNumber = Math.floor(1000000000 + Math.random() * 9000000000);
        cb(null, `${uniqueNumber}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// View logged-in user's profile
router.get('/', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            console.error('No user or user._id in session:', req.session);
            return res.redirect('/login');
        }
        const user = await User.findById(req.session.user._id).populate('connections');
        if (!user) {
            console.error('User not found for ID:', req.session.user._id);
            return res.status(404).send('User not found');
        }
        res.render('admin/view-profile', { layout: 'admin', user });
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.redirect('/login');
    }
});

// Show edit profile page
router.get('/edit-profile', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            console.error('No user or user._id in session:', req.session);
            return res.redirect('/login');
        }
        const user = await User.findById(req.session.user._id);
        if (!user) {
            console.error('User not found for ID:', req.session.user._id);
            return res.status(404).send('User not found');
        }
        res.render('admin/edit-profile', { layout: 'admin', user });
    } catch (err) {
        console.error('Error fetching edit profile:', err);
        res.redirect('/login');
    }
});

// Handle profile update
router.post('/edit-profile', upload.single('profilePicture'), async (req, res) => {
    const { firstName, lastName, username, email, position, phone, street, city, state, postalCode, country, bio } = req.body;

    try {
        if (!req.session.user || !req.session.user._id) {
            console.error('No user or user._id in session:', req.session);
            return res.redirect('/login');
        }
        const user = await User.findById(req.session.user._id);
        if (!user) {
            console.error('User not found for ID:', req.session.user._id);
            return res.status(404).send('User not found');
        }

        // Check for username and email uniqueness
        const existingUsername = await User.findOne({ username, _id: { $ne: user._id } });
        if (existingUsername) {
            return res.status(400).send('Username already taken');
        }
        const existingEmail = await User.findOne({ email, _id: { $ne: user._id } });
        if (existingEmail) {
            return res.status(400).send('Email already in use');
        }

        user.firstName = firstName;
        user.lastName = lastName;
        user.username = username;
        user.email = email;
        user.position = position || '';
        user.phone = phone || '';
        user.address = { street: street || '', city: city || '', state: state || '', postalCode: postalCode || '', country: country || '' };
        user.bio = bio || '';
        user.profilePicture = req.file ? req.file.filename : user.profilePicture;
        user.updatedAt = new Date();

        await user.save();
        // Update session user data
        req.session.user = {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            position: user.position,
            isAdmin: user.isAdmin || false,
            profilePicture: user.profilePicture
        };
        res.redirect('/admin/profile');
    } catch (err) {
        console.error('Error updating profile:', err);
        res.redirect('/admin/edit-profile');
    }
});

// Handle logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.redirect('/admin');
        }
        res.clearCookie('rememberMe');
        res.redirect('/login');
    });
});

// Delete account
router.post('/delete-profile', async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            console.error('No user or user._id in session:', req.session);
            return res.redirect('/login');
        }
        await User.findByIdAndDelete(req.session.user._id);
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.clearCookie('rememberMe');
            res.redirect('/login');
        });
    } catch (err) {
        console.error('Error deleting profile:', err);
        res.redirect('/admin/profile');
    }
});

module.exports = router;