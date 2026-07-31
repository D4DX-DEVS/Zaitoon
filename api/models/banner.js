const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    title: {
        type: String
    },
    image: {
        type: String,
        // Allow PDF-only banners by not hard-requiring image here.
        // Combination rule is enforced via the custom validator below.
        validate: {
            validator: function (v) {
                // Valid if we have either an image or a pdf
                return !!(v || this.pdf);
            },
            message: 'Either image or PDF is required.'
        }
    },
    // Optional PDF attached to the banner
    pdf: {
        type: String
    }

}, {timestamps: true})

module.exports = mongoose.model('Banner', bannerSchema);
