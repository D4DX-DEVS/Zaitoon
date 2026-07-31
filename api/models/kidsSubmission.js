const mongoose = require("mongoose");

const kidsSubmissionSchema = new mongoose.Schema({
    contentType: {
        type: String,
        required: true,
        enum: ["story", "poem", "drawing", "letter", "other"]
    },
    title: {
        type: String,
        required: true
    },
    coverImage: {
        type: String
    },
    storyOrPoem: {
        type: String
    },
    letter: {
        type: String
    },
    drawing: {
        type: String
    },
    drawingDescription: {
        type: String
    },
    kidPhoto: {
        type: String
    },
    kidName: {
        type: String,
        required: true
    },
    kidAge: {
        type: String
    },
    schoolName: {
        type: String
    },
    parentName: {
        type: String,
        required: true
    },
    phoneNo: {
        type: String,
        required: true
    },
    moreTitle: {
        type: String
    },
    moreDescription: {
        type: String
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    },
    highlight: {
        type: String,
        enum: ["Enable", "Disable"]
    },
    highlightExpiresAt: {
        type: Date,
        default: null
    },
    adminRemarks: {
        type: String
    },
    userId: {
        type: String,
        required: true
    },
},
{timestamps: true})

module.exports = mongoose.model("KidsSubmission", kidsSubmissionSchema);