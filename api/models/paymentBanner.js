const mongoose = require('mongoose');

const paymentBannerSchema = new mongoose.Schema({
  active: { type: Boolean, default: false },
  image: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('PaymentBanner', paymentBannerSchema);
