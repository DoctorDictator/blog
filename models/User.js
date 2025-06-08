const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // Ensure emails are stored in lowercase for consistency
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      required: true,
      default: "soldier",
    },
    isAdmin: {
      type: Boolean,
      default: false, // Add isAdmin field with default false
    },
    connections: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequestsSent: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequestsReceived: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dateJoined: {
      type: Date,
      default: Date.now,
    },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
    },
    phone: {
      type: String,
    },
    bio: {
      type: String,
    },
    profilePicture: {
      type: String, // URL or path to image
    },
  },
  {
    timestamps: true,
    collection: "users", // Explicitly set collection name
  }
);

const User = mongoose.model("User", UserSchema);

module.exports = User;
