const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['surPlace', 'livraison'],
    required: true
  },
  numberOfPeople: {
    type: Number,
    required: function() {
      return this.type === 'surPlace';
    }
  },
  address: {
    type: String,
    required: function() {
      return this.type === 'livraison';
    }
  },
  specialRequests: {
    type: String
  },
  dishes: [{
    _id: String,
    name: String,
    price: Number,
    quantity: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'delivered', 'completed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Reservation', reservationSchema);
