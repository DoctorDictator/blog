const express = require('express');
const router = express.Router();
const Category = require('../../models/Category');
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
        console.error('Error fetching user in category:', err);
        res.redirect('/login');
    }
};

// View all categories
router.get('/view-category', fetchFullUser, async (req, res) => {
    try {
        const categories = await Category.find()
            .populate('createdBy')
            .sort({ createdAt: -1 });

        res.render('admin/view-category', {
            layout: 'admin',
            categories,
            user: req.fullUser
        });
    } catch (err) {
        console.error('Error in /admin/view-category:', err);
        res.redirect('/admin');
    }
});

// Show create category page
router.get('/create-category', fetchFullUser, async (req, res) => {
    try {
        const users = await User.find();

        res.render('admin/create-category', {
            layout: 'admin',
            users,
            user: req.fullUser
        });
    } catch (err) {
        console.error('Error in /admin/create-category:', err);
        res.redirect('/admin');
    }
});

// Handle category creation
router.post('/create-category', fetchFullUser, async (req, res) => {
    const { name, createdBy } = req.body;

    try {
        const newCategory = new Category({
            name,
            createdBy,
            createdAt: new Date()
        });

        await newCategory.save();
        res.redirect('/admin/category/view-category');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/category/create-category');
    }
});

// Show edit category page
router.get('/edit-category/:id', fetchFullUser, async (req, res) => {
    try {
        const category = await Category.findById(req.params.id)
            .populate('createdBy');
        const users = await User.find();

        if (!category) {
            return res.status(404).send('Category not found');
        }

        res.render('admin/edit-category', {
            layout: 'admin',
            category,
            users,
            user: req.fullUser
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/category/view-category');
    }
});

// Handle category update
router.post('/edit-category/:id', fetchFullUser, async (req, res) => {
    const { name, createdBy } = req.body;

    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).send('Category not found');
        }

        category.name = name;
        category.createdBy = createdBy;
        category.updatedAt = new Date();

        await category.save();
        res.redirect('/admin/category/view-category');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/category/view-category');
    }
});

// Delete category
router.post('/delete-category/:id', fetchFullUser, async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.redirect('/admin/category/view-category');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/category/view-category');
    }
});

module.exports = router;