const mongoose = require("mongoose");

const brightBoxSchema = new mongoose.Schema({
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
    order: {
        type: Number,
        default: 0,
        index: true
    }
},
{timestamps: true})

module.exports = mongoose.model("BrightBox", brightBoxSchema);