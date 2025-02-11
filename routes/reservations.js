const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const Reservation = require('../models/Reservation');

// @route   POST /api/reservations
// @desc    Créer une nouvelle réservation
// @access  Public
router.post('/', [
  check('date', 'La date est requise').not().isEmpty(),
  check('time', 'L\'heure est requise').not().isEmpty(),
  check('guests', 'Le nombre de personnes est requis').isInt({ min: 1, max: 10 }),
  check('name', 'Le nom est requis').not().isEmpty(),
  check('email', 'Email invalide').isEmail(),
  check('phone', 'Le numéro de téléphone est requis').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const newReservation = new Reservation(req.body);
    const reservation = await newReservation.save();
    res.json(reservation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

// @route   GET /api/reservations
// @desc    Obtenir toutes les réservations
// @access  Private (Staff & Admin)
router.get('/', [auth, checkRole(['staff', 'admin'])], async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .sort({ date: 1, time: 1 });
    res.json(reservations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

// @route   GET /api/reservations/:id
// @desc    Obtenir une réservation par ID
// @access  Private (Staff & Admin)
router.get('/:id', [auth, checkRole(['staff', 'admin'])], async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ msg: 'Réservation non trouvée' });
    }
    res.json(reservation);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Réservation non trouvée' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   PUT /api/reservations/:id
// @desc    Mettre à jour une réservation
// @access  Private (Staff & Admin)
router.put('/:id', [
  auth,
  checkRole(['staff', 'admin']),
  check('status', 'Le statut est requis').isIn(['pending', 'confirmed', 'cancelled'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ msg: 'Réservation non trouvée' });
    }

    res.json(reservation);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Réservation non trouvée' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   DELETE /api/reservations/:id
// @desc    Supprimer une réservation
// @access  Private (Staff & Admin)
router.delete('/:id', [auth, checkRole(['staff', 'admin'])], async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ msg: 'Réservation non trouvée' });
    }

    await reservation.remove();
    res.json({ msg: 'Réservation supprimée' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Réservation non trouvée' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// Créer une nouvelle réservation
router.post('/new', async (req, res) => {
  try {
    const reservation = new Reservation(req.body);
    await reservation.save();
    res.status(201).json(reservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Obtenir toutes les réservations (pour le personnel)
router.get('/all', checkRole(['admin', 'staff']), async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mettre à jour le statut d'une réservation
router.patch('/:id/status', checkRole(['admin', 'staff']), async (req, res) => {
  try {
    const { status } = req.body;
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!reservation) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/reservations/stats
// @desc    Obtenir les statistiques des réservations
// @access  Private (Staff & Admin)
router.get('/stats', [auth, checkRole(['staff', 'admin'])], async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, pending, todayReservations] = await Promise.all([
      Reservation.countDocuments(),
      Reservation.countDocuments({ status: 'pending' }),
      Reservation.countDocuments({
        date: today.toISOString().split('T')[0]
      })
    ]);

    res.json({
      total,
      pending,
      today: todayReservations
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des statistiques:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
