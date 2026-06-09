const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: String,
  price: Number,
  quantity: Number,
  selectedAddons: [{
    name: String,
    price: Number
  }]
});

const orderSchema = new mongoose.Schema({
  orderNumber: { type: Number, unique: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerAddress: { type: String, default: '' },
  deliveryType: { type: String, enum: ['delivery', 'pickup'], required: true },
  items: [orderItemSchema],
  subtotal: Number,
  deliveryFee: { type: Number, default: 0 },
  total: Number,
  status: { type: String, enum: ['pending', 'preparing', 'delivered', 'cancelled'], default: 'pending' },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Auto-increment order number
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const last = await mongoose.model('Order').findOne().sort({ orderNumber: -1 });
    this.orderNumber = last ? last.orderNumber + 1 : 1;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
