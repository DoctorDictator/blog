const express = require('express');
const router = express.Router();
const Comment = require('../../models/Comment');
const mongoose = require('mongoose');
const User = require('../../models/User');

// Middleware to fetch full user object
const fetchFullUser = async (req, res, next) => {
    if (!req.session.user || !req.session.user._id) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findById(req.session.user._id);
        if (!user) {
            return res.status(404).send('User not found');
        }
        req.fullUser = user;
        next();
    } catch (err) {
        console.error('Error fetching user in comments:', err);
        res.redirect('/login');
    }
};

router.get('/view-comments', fetchFullUser, async (req, res) => {
    try {
        const comments = await Comment.find()
            .populate('post', 'title')
            .populate('author', 'username')
            .sort({ createdAt: -1 });

        res.render('admin/view-comments', { 
            layout: 'admin', 
            comments,
            user: req.fullUser
        });
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.status(500).send('Server Error');
    }
});

router.get('/reply-comments/:id', fetchFullUser, async (req, res) => {
    try {
        const commentId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).send('Invalid comment ID');
        }
        const comment = await Comment.findById(commentId)
            .populate('post', 'title')
            .populate('author', 'username');
        if (!comment) {
            return res.status(404).send('Comment not found');
        }
        res.render('admin/reply-comments', { 
            layout: 'admin', 
            comment,
            user: req.fullUser
        });
    } catch (err) {
        console.error('Error fetching comment for reply:', err);
        res.status(500).send('Server Error');
    }
});

router.post('/reply-comments/:id', fetchFullUser, async (req, res) => {
    try {
        const commentId = req.params.id;
        const { replyContent } = req.body;
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).send('Invalid comment ID');
        }
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).send('Comment not found');
        }
        comment.replies.push({
            content: replyContent,
            createdAt: new Date()
        });
        await comment.save();
        res.redirect('/admin/comments/view-comments');
    } catch (err) {
        console.error('Error submitting reply:', err);
        res.status(500).send('Server Error');
    }
});

router.get('/delete-comments/:id', fetchFullUser, async (req, res) => {
    try {
        const commentId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).send('Invalid comment ID');
        }
        const comment = await Comment.findByIdAndDelete(commentId);
        if (!comment) {
            return res.status(404).send('Comment not found');
        }
        res.redirect('/admin/comments/view-comments');
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;