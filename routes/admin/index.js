const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const Post = require("../../models/Post");
const Comment = require("../../models/Comment");
const moment = require("moment");

// Middleware to check if user is authenticated and is an admin
const ensureAuthenticatedAndAdmin = async (req, res, next) => {
  if (!req.session.user || !req.session.user._id) {
    return res.redirect("/login");
  }
  try {
    const user = await User.findById(req.session.user._id);
    if (!user || !user.isAdmin) {
      return res.redirect("/login");
    }
    req.fullUser = user; // Store full user object for use in routes
    next();
  } catch (err) {
    console.error("Error in ensureAuthenticatedAndAdmin:", err);
    res.redirect("/login");
  }
};

// Admin dashboard
router.get("/", ensureAuthenticatedAndAdmin, async (req, res) => {
  try {
    const userId = req.fullUser._id;

    // Fetch total users
    const totalUsers = await User.countDocuments();

    // Fetch user's posts
    const userPosts = await Post.find({ author: userId });
    const totalPosts = userPosts.length;

    // Calculate total views on user's posts
    const totalViews = userPosts.reduce(
      (sum, post) => sum + (post.views || 0),
      0
    );

    // Fetch comments on user's posts
    const commentCount = await Comment.countDocuments({
      post: { $in: userPosts.map((post) => post._id) },
    });

    // Calculate average views per post
    const averageViews =
      totalPosts > 0 ? (totalViews / totalPosts).toFixed(2) : 0;

    // Aggregate monthly views for the last 12 months
    const startDate = moment().subtract(12, "months").startOf("month");
    const monthlyViews = await Post.aggregate([
      { $match: { author: userId, createdAt: { $gte: startDate.toDate() } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          views: { $sum: "$views" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Format monthly views for Chart.js
    const labels = [];
    const viewsData = [];
    for (let i = 0; i < 12; i++) {
      const month = moment()
        .subtract(11 - i, "months")
        .format("MMMM YYYY");
      labels.push(month);
      const monthKey = moment()
        .subtract(11 - i, "months")
        .format("YYYY-MM");
      const monthData = monthlyViews.find((m) => m._id === monthKey);
      viewsData.push(monthData ? monthData.views : 0);
    }

    res.render("admin/index", {
      layout: "admin",
      user: req.fullUser,
      totalUsers,
      totalPosts,
      totalViews,
      commentCount,
      averageViews,
      chartData: {
        labels: JSON.stringify(labels),
        views: JSON.stringify(viewsData),
      },
    });
  } catch (err) {
    console.error("Error in admin dashboard:", err);
    res.render("admin/index", {
      layout: "admin",
      user: req.fullUser,
      error: "Server error while loading dashboard",
    });
  }
});

module.exports = router;
