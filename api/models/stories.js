const mongoose = require("mongoose");

const storySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    Tag: {
        type: String,
        required: true
    },
    coverImage: {
        type: String,
        required: true
    },
    mlTitle: {
        type: String,
        required: true
    },
    mlDescription: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active"
    },
    // Priority in listing (1 = highest).
    // Kept consistent with SingleStory priority handling.
    priority: {
        type: Number,
        min: 1,
        default: 1,
        index: true
    },
    hinTitle: {
        type: String,
    },
    hinDescription: {
        type: String,
    },
    urTitle: {
        type: String,
    },
    urDescription: {
        type: String,
    },
    // Optional seasons array. Each season contains simple episode subdocuments.
    seasons: [
        new mongoose.Schema(
            {
                seasonNumber: { type: Number, required: true },
                seasonBanner: { type: String, required: true },
                episodes: [
                    new mongoose.Schema(
                        {
                            title: { 
                                type: String,
                                required: true
                            },
                            mlTitle: { type: String},
                            urTitle: { type: String},
                            hinTitle: { type: String},
                            status: {
                                type: String,
                                enum: ["Enable", "Disable"],
                                default: "Disable",
                            },
                            coverImage: {
                                type: String
                            },
                            readTime: {
                                type: String
                            },
                            storyFile: {
                                type: String
                            },
                            mlStoryFile: {
                                type: String
                            },
                            urStoryFile: {
                                type: String
                            },
                            hinStoryFile: {
                                type: String
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
                            highlight: {
                                type: String,
                                enum: ["Enable", "Disable"],
                                default: "Disable"
                            },
                            highlightExpiresAt: {
                                type: Date,
                                default: null
                            },
                            music: {
                                type: String
                            },
                        },
                        { _id: true, timestamps: true }
                    ),
                ],
            },
            { _id: true, timestamps: true }
        ),
    ],
},
{ timestamps: true });

const Story = mongoose.model("Story", storySchema);

module.exports = Story;