const express = require("express");
const router = express.Router();
const Post = require("../../models/Post");
const Comment = require("../../models/Comment");
const Category = require("../../models/Category");
const User = require("../../models/User");

const POSTS_PER_PAGE = 10;

// Middleware to load categories for sidebar
router.use(async (req, res, next) => {
  try {
    const categories = await Category.find().lean();
    res.locals.categories = categories;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
router.get("/about", (req, res) => {
  res.render("home/about", {
    layout: false,
    currentUser: req.session.user || null,
  });
});

// Initial index page - loads first page of posts
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    // Fetch published posts
    const posts = await Post.find({ status: "published" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .populate("category")
      .populate("author")
      .lean();

    const totalPosts = await Post.countDocuments({ status: "published" });
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    // Fetch categories with post counts
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: "posts",
          localField: "_id",
          foreignField: "category",
          as: "posts",
        },
      },
      {
        $project: {
          name: 1,
          postCount: { $size: "$posts" },
        },
      },
      { $sort: { name: 1 } },
    ]);

    // Fetch recent posts
    const recentPosts = await Post.find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title slug thumbnail")
      .lean();

    // Fetch popular posts
    const popularPosts = await Post.find({ status: "published" })
      .sort({ views: -1 })
      .limit(5)
      .select("title slug views")
      .lean();

    // Fetch random posts
    const randomPosts = await Post.aggregate([
      { $match: { status: "published" } },
      { $sample: { size: 3 } },
      { $project: { title: 1, slug: 1, thumbnail: 1 } },
    ]);

    // Fetch user stats if logged in
    let userStats = null;
    if (req.session.user) {
      const userId = req.session.user._id;
      const userPosts = await Post.find({
        author: userId,
        status: "published",
      }).lean();
      const postIds = userPosts.map((post) => post._id);
      const totalViews = userPosts.reduce(
        (sum, post) => sum + (post.views || 0),
        0
      );
      const commentCount = await Comment.countDocuments({
        post: { $in: postIds },
      });

      userStats = {
        postCount: userPosts.length,
        totalViews,
        commentCount,
      };
    }

    res.render("home/index", {
      layout: "home",
      posts,
      currentPage: page,
      totalPages,
      categories,
      recentPosts,
      popularPosts,
      randomPosts,
      userStats,
      currentUser: req.session.user || null,
    });
  } catch (err) {
    console.error("Error in home index:", err);
    res.status(500).send("Server error");
  }
});

// API for lazy loading posts
router.get("/api/posts", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const posts = await Post.find({ status: "published" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .populate("category")
      .populate("author")
      .lean();

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Post page with comments
router.get("/post/:slug", async (req, res) => {
  try {
    const post = await Post.findOne({
      slug: req.params.slug,
      status: "published",
    })
      .populate("author")
      .populate("category")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "firstName lastName username",
        },
      })
      .lean();

    if (!post) {
      return res.status(404).send("Post not found");
    }

    // Increment views
    await Post.updateOne({ slug: req.params.slug }, { $inc: { views: 1 } });

    // Add author info to replies
    const currentUser = req.session.user;
    post.comments = post.comments.map((comment) => {
      comment.replies = comment.replies.map((reply) => ({
        ...reply,
        author: currentUser,
      }));
      return comment;
    });

    res.render("home/posts", {
      post,
      currentUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Add comment
router.post("/comment/:postId", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const { content } = req.body;
    const post = await Post.findById(req.params.postId);

    if (!post) return res.status(404).send("Post not found");
    if (!post.allowComments)
      return res.status(403).send("Comments are disabled");

    const comment = new Comment({
      content,
      post: req.params.postId,
      author: req.session.user._id,
    });

    await comment.save();
    await Post.findByIdAndUpdate(req.params.postId, {
      $push: { comments: comment._id },
    });

    res.redirect(`/post/${post.slug}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Add reply to comment
router.post("/comment/:commentId/reply", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const { content } = req.body;
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) return res.status(404).send("Comment not found");

    const post = await Post.findById(comment.post);
    if (!post) return res.status(404).send("Post not found");
    if (!post.allowComments)
      return res.status(403).send("Comments are disabled");

    const reply = {
      content,
      createdAt: new Date(),
      author: req.session.user._id,
    };

    await Comment.findByIdAndUpdate(req.params.commentId, {
      $push: { replies: reply },
    });

    res.redirect(`/post/${post.slug}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// User profile page with their posts
router.get("/user/:username", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).send("User not found");

    const posts = await Post.find({
      author: user._id,
      status: "published",
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .populate("category")
      .populate("author")
      .lean();

    const totalPosts = await Post.countDocuments({
      author: user._id,
      status: "published",
    });
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    res.render("home/user", {
      user,
      posts,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// API for lazy loading user posts
router.get("/api/user/:username/posts", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const posts = await Post.find({
      author: user._id,
      status: "published",
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .populate("category")
      .populate("author")
      .lean();

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Category page with posts
router.get("/category/:name", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const category = await Category.findOne({ name: req.params.name }).lean();
    if (!category) return res.status(404).send("Category not found");

    const posts = await Post.find({
      category: category._id,
      status: "published",
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .populate("category")
      .populate("author")
      .lean();

    const totalPosts = await Post.countDocuments({
      category: category._id,
      status: "published",
    });
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    res.render("home/category", {
      category,
      posts,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// API for lazy loading category posts
router.get("/api/category/:name/posts", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const category = await Category.findOne({ name: req.params.name }).lean();
    if (!category) return res.status(404).json({ error: "Category not found" });

    const posts = await Post.find({
      category: category._id,
      status: "published",
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .populate("category")
      .populate("author")
      .lean();

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Search posts
router.get("/search", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;
    const searchTerm = req.query.q ? req.query.q.trim() : "";

    let query = { status: "published" };
    if (searchTerm) {
      query.$or = [
        { title: { $regex: searchTerm, $options: "i" } },
        { content: { $regex: searchTerm, $options: "i" } },
        { tags: { $regex: searchTerm, $options: "i" } },
      ];
      const category = await Category.findOne({
        name: { $regex: searchTerm, $options: "i" },
      }).lean();
      if (category) {
        query.$or.push({ category: category._id });
      }
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .populate("category")
      .populate("author")
      .lean();

    const totalPosts = await Post.countDocuments(query);
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    res.render("home/search", {
      posts,
      searchTerm,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// API for search lazy loading
router.get("/api/search", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;
    const searchTerm = req.query.q ? req.query.q.trim() : "";

    let query = { status: "published" };
    if (searchTerm) {
      query.$or = [
        { title: { $regex: searchTerm, $options: "i" } },
        { content: { $regex: searchTerm, $options: "i" } },
        { tags: { $regex: searchTerm, $options: "i" } },
      ];
      const category = await Category.findOne({
        name: { $regex: searchTerm, $options: "i" },
      }).lean();
      if (category) {
        query.$or.push({ category: category._id });
      }
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_PAGE)
      .populate("category")
      .populate("author")
      .lean();

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
