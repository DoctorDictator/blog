require("dotenv").config();

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const exphbs = require("express-handlebars");
const mongoose = require("mongoose");
const handlebars = require("handlebars");
const multer = require("multer");
const methodOverride = require("method-override");
const moment = require("moment");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const {
  allowInsecurePrototypeAccess,
} = require("@handlebars/allow-prototype-access");

const app = express();

// Cookie parser middleware
app.use(cookieParser());

// Session middleware with MongoDB store
app.use(
  session({
    secret: process.env.SECRET_KEY || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl:
        process.env.MONGO_URI ||
        "mongodb+srv://myuser:u3YDevNuBOD0MLVB@cluster0.rojgfzb.mongodb.net/blog?retryWrites=true&w=majority&tls=true&tlsInsecure=false",
      collectionName: "sessions",
      ttl: 24 * 60 * 60,
    }),
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Log session middleware setup
app.use((req, res, next) => {
  next();
});

// Middleware to check for remember me token and auto-login
app.use(async (req, res, next) => {
  if (!req.session.user && req.cookies.rememberMe) {
    try {
      const decoded = jwt.verify(
        req.cookies.rememberMe,
        process.env.SECRET_KEY || "your-secret-key"
      );
      const user = await require("./models/User").findById(decoded.userId);
      if (user) {
        req.session.user = {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email,
          position: user.position,
          isAdmin: user.isAdmin || false,
          profilePicture: user.profilePicture,
        };
      }
    } catch (err) {
      console.error("Auto-login failed:", err);
      res.clearCookie("rememberMe");
    }
  }
  res.locals.currentUser = req.session.user || null;
  next();
});

// Connect to MongoDB Atlas with retry logic
const connectWithRetry = () => {
  mongoose
    .connect(
      process.env.MONGO_URI ||
        "mongodb+srv://myuser:u3YDevNuBOD0MLVB@cluster0.rojgfzb.mongodb.net/blog?retryWrites=true&w=majority&tls=true&tlsInsecure=false",
      {
        serverSelectionTimeoutMS: 5000, // Reduce timeout for faster retries
        heartbeatFrequencyMS: 10000,
      }
    )
    .then(() => console.log("Database connected successfully"))
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
      setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
    });
};
connectWithRetry();

// Test MongoDB connection route
app.get("/test-mongo", async (req, res) => {
  try {
    const User = require("./models/User");
    await User.create({
      username: "testuser",
      email: `test${Date.now()}@example.com`,
    });
    res.send("MongoDB connection works! User added.");
  } catch (err) {
    res.status(500).send(`MongoDB error: ${err.message}`);
  }
});

app.use(methodOverride("_method"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("uploads"));
app.use(
  "/profile-pic-harsh-shishodia",
  express.static("profile-pic-harsh-shishodia")
);

app.engine(
  "handlebars",
  exphbs.engine({
    handlebars: allowInsecurePrototypeAccess(handlebars),
    helpers: {
      formatDate: function (date, format) {
        if (!date) return "N/A";
        const validFormat =
          typeof format === "string" ? format : "YYYY-MM-DD HH:mm:ss";
        return moment(date).format(validFormat);
      },
      if_eq: function (a, b, opts) {
        if (a == b) {
          return opts.fn(this);
        } else {
          return opts.inverse(this);
        }
      },
      json: function (obj) {
        return JSON.stringify(obj);
      },
      truncate: (str, len) =>
        str.length > len ? str.substring(0, len) + "..." : str,
      ifEquals: (a, b, options) =>
        a === b ? options.fn(this) : options.inverse(this),
      add: (a, b) => a + b,
      subtract: (a, b) => a - b,
      pagination: (current, total) => {
        let delta = 2;
        let range = [];
        for (
          let i = Math.max(1, current - delta);
          i <= Math.min(total, current + delta);
          i++
        ) {
          range.push(i);
        }
        return range;
      },
      gt: (a, b) => a > b,
      lt: (a, b) => a < b,
    },
    layoutsDir: path.join(__dirname, "views/layout"),
    defaultLayout: "home",
    partialsDir: path.join(__dirname, "views/partials"),
  })
);
app.set("view engine", "handlebars");

// Routes
app.use("/", require("./routes/home/index"));
app.use("/", require("./routes/auth"));
app.use("/admin", require("./routes/admin/index"));
app.use("/admin/posts", require("./routes/admin/posts"));
app.use("/admin/category", require("./routes/admin/category"));
app.use("/admin/comments", require("./routes/admin/comments"));
app.use("/admin/profile", require("./routes/admin/profile"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
