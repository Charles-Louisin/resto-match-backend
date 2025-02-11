const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const User = require('../models/User');

// @route   GET /api/staff
// @desc    Obtenir la liste du personnel
// @access  Private (Admin only)
router.get('/', [auth, checkRole(['admin'])], async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' })
      .select('-password')
      .sort({ name: 1 });
    res.json(staff);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

// @route   POST /api/staff
// @desc    Ajouter un membre du personnel
// @access  Private (Admin only)
router.post('/', [
  auth,
  checkRole(['admin']),
  [
    check('name', 'Le nom est requis').not().isEmpty(),
    check('email', 'Email invalide').isEmail(),
    check('password', 'Le mot de passe doit contenir au moins 6 caractères').isLength({ min: 6 }),
    check('role', 'Le rôle est requis').isIn(['staff', 'admin']),
    check('salary', 'Le salaire est requis').isFloat({ min: 0 })
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, role, salary } = req.body;

  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: 'Cet utilisateur existe déjà' });
    }

    user = new User({
      name,
      email,
      password,
      role,
      salary
    });

    await user.save();

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

// @route   PUT /api/staff/:id
// @desc    Mettre à jour un membre du personnel
// @access  Private (Admin only)
router.put('/:id', [
  auth,
  checkRole(['admin']),
  [
    check('salary', 'Le salaire est requis').isFloat({ min: 0 })
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: 'Utilisateur non trouvé' });
    }

    // Vérifier que l'utilisateur est bien un membre du personnel
    if (!['staff', 'admin'].includes(user.role)) {
      return res.status(400).json({ msg: 'Cet utilisateur n\'est pas un membre du personnel' });
    }

    // Mettre à jour les champs modifiables
    if (req.body.salary) user.salary = req.body.salary;
    if (req.body.name) user.name = req.body.name;

    await user.save();

    // Retourner l'utilisateur sans le mot de passe
    const updatedUser = await User.findById(req.params.id).select('-password');
    res.json(updatedUser);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Utilisateur non trouvé' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   DELETE /api/staff/:id
// @desc    Supprimer un membre du personnel
// @access  Private (Admin only)
router.delete('/:id', [auth, checkRole(['admin'])], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ msg: 'Utilisateur non trouvé' });
    }

    // Vérifier que l'utilisateur est bien un membre du personnel
    if (!['staff', 'admin'].includes(user.role)) {
      return res.status(400).json({ msg: 'Cet utilisateur n\'est pas un membre du personnel' });
    }

    await user.remove();
    res.json({ msg: 'Membre du personnel supprimé' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Utilisateur non trouvé' });
    }
    res.status(500).send('Erreur serveur');
  }
});

// @route   GET /api/staff/stats
// @desc    Obtenir les statistiques du personnel
// @access  Private (Admin only)
router.get('/stats', [auth, checkRole(['admin'])], async (req, res) => {
  try {
    const totalStaff = await User.countDocuments({ role: 'staff' });
    const totalAdmin = await User.countDocuments({ role: 'admin' });
    const averageSalary = await User.aggregate([
      { $match: { role: { $in: ['staff', 'admin'] } } },
      { $group: { _id: null, avg: { $avg: '$salary' } } }
    ]);

    res.json({
      totalStaff,
      totalAdmin,
      averageSalary: averageSalary[0]?.avg || 0
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
