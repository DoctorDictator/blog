const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CategorySchema = new Schema({
    name : {
        type : String,
        required : true
    },
    createdBy : [{
        type : Schema.Types.ObjectId,
        ref : 'User'
    }],
    createdAt : {
        type : Date,
        default : Date.now()
    }

});

const Category = mongoose.model('Category',CategorySchema);
module.exports = Category;