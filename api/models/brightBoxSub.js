const mongoose = require("mongoose");


const brightBoxSubSchema = new mongoose.Schema({
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
    hnTitle: {
        type: String
    },
    image: {
        type: String
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BrightBox",
        required: true
    },
},
{timestamps: true})

module.exports = mongoose.model("BrightBoxSub", brightBoxSubSchema);