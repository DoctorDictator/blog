const express = require('express');
const router = express.Router();
const slugify = require('slugify');
const multer = require('multer');
const path = require('path');
const Post = require('../../models/Post');
const User = require('../../models/User');
const Category = require('../../models/Category');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads');
        if (!require('fs').existsSync(uploadDir)) {
            require('fs').mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueNumber = Math.floor(1000000000 + Math.random() * 9000000000);
        cb(null, `${uniqueNumber}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

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
        console.error('Error fetching user in posts:', err);
        res.redirect('/login');
    }
};

// View all posts
router.get('/view-posts', fetchFullUser, async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('author')
            .populate('category')
            .sort({ dateCreated: -1 });

        res.render('admin/view-posts', {
            layout: 'admin',
            posts,
            user: req.fullUser
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

// Show create post page
router.get('/create-posts', fetchFullUser, async (req, res) => {
    try {
        const authors = await User.find();
        const categories = await Category.find();

        res.render('admin/create-posts', {
            layout: 'admin',
            authors,
            categories,
            dateCreated: new Date(),
            user: req.fullUser
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

// Handle post creation
router.post('/create-posts', fetchFullUser, upload.single('thumbnail'), async (req, res) => {
    const { title, author, status, category, content, tags, allowComments } = req.body;

    try {
        if (!content || content.trim() === '') {
            console.error('Content missing:', req.body);
            return res.status(400).render('admin/create-posts', {
                layout: 'admin',
                error: 'Content is required',
                authors: await User.find(),
                categories: await Category.find(),
                user: req.fullUser
            });
        }

        let slug = slugify(title, { lower: true, strict: true });
        let existingPost = await Post.findOne({ slug });
        if (existingPost) {
            slug = `${slug}-${Date.now()}`;
        }

        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

        const newPost = new Post({
            title,
            slug,
            author,
            status,
            category,
            content,
            thumbnail: req.file ? req.file.filename : null,
            tags: tagsArray,
            allowComments: allowComments === 'on',
            dateCreated: new Date(),
            editedAt: new Date()
        });

        await newPost.save();
        res.redirect('/admin/posts/view-posts');
    } catch (err) {
        console.error(err);
        res.status(500).render('admin/create-posts', {
            layout: 'admin',
            error: 'Failed to create post',
            authors: await User.find(),
            categories: await Category.find(),
            user: req.fullUser
        });
    }
});

// Show edit post page
router.get('/edit-posts/:slug', fetchFullUser, async (req, res) => {
    try {
        const post = await Post.findOne({ slug: req.params.slug })
            .populate('author')
            .populate('category');
        const authors = await User.find();
        const categories = await Category.find();

        if (!post) {
            return res.status(404).send('Post not found');
        }

        res.render('admin/edit-posts', {
            layout: 'admin',
            post,
            authors,
            categories,
            editedAt: new Date(),
            user: req.fullUser
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/posts/view-posts');
    }
});

// Handle post update
router.post('/edit-posts/:slug', fetchFullUser, upload.single('thumbnail'), async (req, res) => {
    const { title, author, status, category, content, tags, allowComments } = req.body;

    try {
        const post = await Post.findOne({ slug: req.params.slug });

        if (!post) {
            return res.status(404).send('Post not found');
        }

        if (!content || content.trim() === '') {
            console.error('Content missing:', req.body);
            return res.status(400).render('admin/edit-posts', {
                layout: 'admin',
                error: 'Content is required',
                post,
                authors: await User.find(),
                categories: await Category.find(),
                user: req.fullUser
            });
        }

        if (title !== post.title) {
            let newSlug = slugify(title, { lower: true, strict: true });
            let existing = await Post.findOne({ slug: newSlug });

            if (existing && existing._id.toString() !== post._id.toString()) {
                newSlug = `${newSlug}-${Date.now()}`;
            }

            post.slug = newSlug;
        }

        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

        post.title = title;
        post.author = author;
        post.status = status;
        post.category = category;
        post.content = content;
        post.thumbnail = req.file ? req.file.filename : post.thumbnail;
        post.tags = tagsArray;
        post.allowComments = allowComments === 'on';
        post.editedAt = new Date();

        await post.save();
        res.redirect('/admin/posts/view-posts');
    } catch (err) {
        console.error(err);
        res.status(500).render('admin/edit-posts', {
            layout: 'admin',
            error: 'Failed to update post',
            post,
            authors: await User.find(),
            categories: await Category.find(),
            user: req.fullUser
        });
    }
});

// Delete post by slug
router.delete('/delete-posts/:slug', fetchFullUser, async (req, res) => {
    try {
        await Post.findOneAndDelete({ slug: req.params.slug });
        res.redirect('/admin/posts/view-posts');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/posts/view-posts');
    }
});

module.exports = router;
