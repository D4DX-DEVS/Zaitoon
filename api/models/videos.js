const mongoose = require("mongoose");

const videosSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    video: {
        type: String,
        required: true
    },
    thumbnail: {
        type: String,
        default: null
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VideosCategory",
        required: true
    
    },
    language: {
        type: String,
        enum: ["English","Malayalam", "Hindi", "Urdu"]
    },
    // Persistent ordering inside each category (lower = earlier)
    order: {
        type: Number,
        default: 0,
        index: true
    }
},
{timestamps: true})

module.exports = mongoose.model("Videos", videosSchema);
