const mongoose = require("mongoose");

const videosCategorySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    priority: {
        type: Number,
        default: 0
    }
},
{timestamps: true})

module.exports = mongoose.model("VideosCategory", videosCategorySchema);