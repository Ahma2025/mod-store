const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { menu } = require('../db');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Public: available items
router.get('/', (req, res) => {
  menu.find({ available: true }, (err, docs) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(docs);
  });
});

// Admin: all items
router.get('/all', auth, (req, res) => {
  menu.find({}, (err, docs) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(docs);
  });
});

// Admin: add item
router.post('/', auth, upload.single('image'), (req, res) => {
  const { name, description, price, category, addons } = req.body;
  const item = {
    name,
    description: description || '',
    price: Number(price),
    category: category || 'بيتزا',
    image: req.file ? `/uploads/${req.file.filename}` : '',
    addons: addons ? JSON.parse(addons) : [],
    available: true,
    createdAt: new Date()
  };
  menu.insert(item, (err, doc) => {
    if (err) return res.status(400).json({ message: err.message });
    res.status(201).json(doc);
  });
});

// Admin: update item
router.put('/:id', auth, upload.single('image'), (req, res) => {
  const { name, description, price, category, addons, available } = req.body;
  const update = {
    name, description,
    price: Number(price),
    category,
    available: available === 'true'
  };
  if (addons) update.addons = JSON.parse(addons);
  if (req.file) update.image = `/uploads/${req.file.filename}`;
  menu.update({ _id: req.params.id }, { $set: update }, {}, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    menu.findOne({ _id: req.params.id }, (err, doc) => res.json(doc));
  });
});

// Admin: delete item
router.delete('/:id', auth, (req, res) => {
  menu.remove({ _id: req.params.id }, {}, (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'تم الحذف' });
  });
});

module.exports = router;
