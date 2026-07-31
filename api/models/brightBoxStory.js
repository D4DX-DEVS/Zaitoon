const mongoose = require("mongoose");

const brightBoxStorySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    mlTitle: {
        type: String
    },
    urTitle: {
        type: String
    },
    hinTitle: {
        type: String
    },
    image: {
        type: String
    },
    enFile:{
        type: String,
        required: true
    },
    mlFile:{
        type: String
    },
    urFile:{
        type: String
    },
    hinFile:{
        type: String
    },
    highlight: {
        type: String,
        enum: ["Enable", "Disable"],
        default: "Disable"
    },
    highlightExpiresAt: {
        type: Date,
        default: null
    },
    adBanner: {
        type: String
    },
    mlBanner: {
        type: String
    },
    urBanner: {
        type: String
    },
    hinBanner: {
        type: String
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BrightBox",
        required: true
    },
    order: {
        type: Number,
        default: 0,
        index: true
    }
},
{timestamps: true})

module.exports = mongoose.model("BrightBoxStory", brightBoxStorySchema);