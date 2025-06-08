const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Register route - GET
router.get("/register", (req, res) => {
  res.render("home/register", { layout: false, error: null });
});

// Register route - POST
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, confirmPassword } =
      req.body;

    console.log("Register attempt:", { firstName, lastName, username, email });

    // Validate password match
    if (password !== confirmPassword) {
      console.log("Password mismatch");
      return res.render("auth/register", {
        layout: false,
        error: "Passwords do not match",
      });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      console.log("User already exists:", existingUser.email);
      return res.render("auth/register", {
        layout: false,
        error: "Username or email already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
      position: "soldier",
      connections: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      blockedUsers: [],
      address: {},
      phone: "",
      bio: "",
      profilePicture: "",
      isAdmin: false, // Default to false; set to true manually in DB for admin users
    });

    await newUser.save();
    console.log("New user saved:", newUser);

    // Start session
    req.session.user = {
      _id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      username: newUser.username,
      email: newUser.email,
      position: newUser.position,
      isAdmin: newUser.isAdmin || false,
    };

    console.log("Session after registration:", req.session.user);

    // Redirect based on user role
    if (newUser.isAdmin) {
      res.redirect("/admin");
    } else {
      res.redirect("/");
    }
  } catch (err) {
    console.error("Registration error:", err);
    res.render("home/register", {
      layout: false,
      error: "Server error during registration",
    });
  }
});

// Login route - GET
router.get("/login", (req, res) => {
  // Check for remember me token
  const token = req.cookies.rememberMe;
  if (token) {
    try {
      const decoded = jwt.verify(token, "your-secret-key");
      console.log("Remember me token verified:", decoded);
      return res.redirect("/");
    } catch (err) {
      console.error("Remember me token invalid:", err);
      // Invalid token, proceed to login page
    }
  }
  res.render("home/login", { layout: false, error: null });
});

// Login route - POST
router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    console.log("Login attempt:", { email, rememberMe });

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.render("home/login", {
        layout: false,
        error: "Invalid email or password",
      });
    }
    console.log("User found:", user.email);

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch for user:", user.email);
      return res.render("home/login", {
        layout: false,
        error: "Invalid email or password",
      });
    }
    console.log("Password matched for user:", user.email);

    // Start session
    req.session.user = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      position: user.position,
      isAdmin: user.isAdmin || false,
    };

    console.log("Session after login:", req.session.user);

    // Handle "Remember Me" functionality
    if (rememberMe) {
      const token = jwt.sign({ userId: user._id }, "your-secret-key", {
        expiresIn: "30d",
      });
      res.cookie("rememberMe", token, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });
      console.log("Remember me token set:", token);
    }

    // Redirect based on user role
    if (user.isAdmin) {
      console.log("Redirecting admin to /admin");
      res.redirect("/admin");
    } else {
      console.log("Redirecting user to /");
      res.redirect("/");
    }
  } catch (err) {
    console.error("Login error:", err);
    res.render("home/login", {
      layout: false,
      error: "Server error during login",
    });
  }
});

// Logout route
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("rememberMe");
    console.log("Session destroyed, redirecting to /login");
    res.redirect("/login");
  });
});

module.exports = router;
