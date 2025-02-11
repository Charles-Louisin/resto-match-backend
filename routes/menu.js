const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const MenuItem = require('../models/MenuItem');

// @route   GET /api/menu
// @desc    Obtenir tous les éléments du menu
// @access  Public
router.get('/', async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ available: true })
      .sort({ category: 1, name: 1 });
    res.json(menuItems);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

// @route   POST /api/menu
// @desc    Ajouter un nouvel élément au menu
// @access  Private (Staff & Admin)
router.post('/', [
  auth,
  checkRole(['staff', 'admin']),
  [
    check('name', 'Le nom est requis').not().isEmpty(),
    check('description', 'La description est requise').not().isEmpty(),
    check('price', 'Le prix est requis').isFloat({ min: 0 }),
    check('category', 'La catégorie est requise').isIn(['Entrées', 'Plats', 'Desserts', 'Boissons']),
    check('image', 'L\'image est requise').not().isEmpty()
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Log des données reçues
    console.log('Données reçues:', {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      imageLength: req.body.image ? req.body.image.length : 0
    });

    // Vérification des données
    if (!req.body.name || !req.body.description || !req.body.price || !req.body.category || !req.body.image) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    // Vérification du format du prix
    const price = parseFloat(req.body.price);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ message: 'Le prix doit être un nombre positif' });
    }

    // Création et sauvegarde de l'élément
    const newMenuItem = new MenuItem({
      name: req.body.name,
      description: req.body.description,
      price: price,
      category: req.body.category,
      image: req.body.image,
      available: req.body.available !== undefined ? req.body.available : true
    });

    const menuItem = await newMenuItem.save();
    res.json(menuItem);
  } catch (err) {
    console.error('Erreur détaillée:', err);
    res.status(500).json({ 
      message: 'Erreur lors de l\'ajout de l\'élément au menu',
      error: err.message 
    });
  }
});

// @route   PUT /api/menu/:id
// @desc    Mettre à jour un élément du menu
// @access  Private (Staff & Admin)
router.put('/:id', [
  auth,
  checkRole(['staff', 'admin'])
], async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!menuItem) {
      return res.status(404).json({ msg: 'Élément non trouvé' });
    }

    res.json(menuItem);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Élément non trouvé' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   DELETE /api/menu/:id
// @desc    Supprimer un élément du menu
// @access  Private (Staff & Admin)
router.delete('/:id', [auth, checkRole(['staff', 'admin'])], async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({ msg: 'Élément non trouvé' });
    }

    // Au lieu de supprimer, on marque comme non disponible
    menuItem.available = false;
    await menuItem.save();

    res.json({ msg: 'Élément supprimé du menu' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Élément non trouvé' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   GET /api/menu/categories
// @desc    Obtenir toutes les catégories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await MenuItem.distinct('category');
    res.json(categories);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

// @route   GET /api/menu/stats
// @desc    Obtenir les statistiques du menu
// @access  Private (Staff & Admin)
router.get('/stats', [auth, checkRole(['staff', 'admin'])], async (req, res) => {
  try {
    const totalItems = await MenuItem.countDocuments({ available: true });

    res.json({
      totalItems
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des statistiques:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
