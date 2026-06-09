const mongoose = require('mongoose');

const addonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, default: 0 }
});

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  image: { type: String, default: '' },
  category: { type: String, default: 'بيتزا' },
  addons: [addonSchema],
  available: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
