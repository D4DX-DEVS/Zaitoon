const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['admin', 'app'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: null
  },
  senderName: {
    type: String,
    trim: true,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema);
