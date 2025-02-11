const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const Order = require('../models/Order');

// @route   POST /api/orders
// @desc    Créer une nouvelle commande
// @access  Private
router.post('/', [
  auth,
  [
    check('items', 'Les items sont requis').isArray(),
    check('items.*.menuItem', 'L\'ID du menu item est requis').not().isEmpty(),
    check('items.*.quantity', 'La quantité est requise').isInt({ min: 1 }),
    check('totalAmount', 'Le montant total est requis').isFloat({ min: 0 })
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const newOrder = new Order({
      user: req.user.id,
      ...req.body
    });

    const order = await newOrder.save();
    res.json(order);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

// @route   GET /api/orders
// @desc    Obtenir toutes les commandes (staff) ou les commandes de l'utilisateur (client)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let orders;
    if (['staff', 'admin'].includes(req.user.role)) {
      orders = await Order.find()
        .populate('user', ['name', 'email'])
        .populate('items.menuItem')
        .sort({ createdAt: -1 });
    } else {
      orders = await Order.find({ user: req.user.id })
        .populate('items.menuItem')
        .sort({ createdAt: -1 });
    }
    res.json(orders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

// @route   GET /api/orders/:id
// @desc    Obtenir une commande par ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', ['name', 'email'])
      .populate('items.menuItem');

    if (!order) {
      return res.status(404).json({ msg: 'Commande non trouvée' });
    }

    // Vérifier si l'utilisateur est autorisé à voir cette commande
    if (req.user.role === 'client' && order.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Non autorisé' });
    }

    res.json(order);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Commande non trouvée' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   PUT /api/orders/:id
// @desc    Mettre à jour le statut d'une commande
// @access  Private (Staff & Admin)
router.put('/:id', [
  auth,
  checkRole(['staff', 'admin']),
  [
    check('status', 'Le statut est requis').isIn(['pending', 'preparing', 'ready', 'delivered', 'cancelled'])
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { status: req.body.status } },
      { new: true }
    ).populate('user', ['name', 'email'])
     .populate('items.menuItem');

    if (!order) {
      return res.status(404).json({ msg: 'Commande non trouvée' });
    }

    res.json(order);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Commande non trouvée' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   DELETE /api/orders/:id
// @desc    Annuler une commande
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: 'Commande non trouvée' });
    }

    // Vérifier si l'utilisateur est autorisé à annuler cette commande
    if (req.user.role === 'client' && order.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Non autorisé' });
    }

    // Au lieu de supprimer, on marque comme annulée
    order.status = 'cancelled';
    await order.save();

    res.json({ msg: 'Commande annulée' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Commande non trouvée' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   GET /api/orders/stats
// @desc    Obtenir les statistiques des commandes
// @access  Private (Staff & Admin)
router.get('/stats', [auth, checkRole(['staff', 'admin'])], async (req, res) => {
  try {
    const [total, pending, preparing] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'preparing' })
    ]);

    res.json({
      total,
      pending,
      preparing
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des statistiques:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
