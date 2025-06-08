const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CommentSchema = new Schema({
    content: { 
        type: String,
        required: true 
    },
    post: {
        type: Schema.Types.ObjectId,
        ref: 'Post',
        required: true 
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true 
    },
    createdAt: {
        type: Date, 
        default: Date.now 
    },
    replies: [{
        content: String,
        createdAt: { 
            type: Date, 
            default: Date.now 
        } 
    }]
}, { collection: 'comment' });

const Comment = mongoose.model('Comment', CommentSchema);
module.exports = Comment;