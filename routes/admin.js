const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const MenuItem = require('../models/MenuItem');

// Middleware pour vérifier si l'utilisateur est admin
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent effectuer cette action.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Route pour obtenir les statistiques générales
router.get('/stats', [auth, isAdmin], async (req, res) => {
  try {
    // Calculer les statistiques des derniers 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Statistiques des revenus
    const revenueStats = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Statistiques des commandes
    const orderStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 }
        }
      }
    ]);

    // Statistiques des clients (utilisateurs avec rôle 'client')
    const customerStats = await User.aggregate([
      {
        $match: {
          role: 'client',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 }
        }
      }
    ]);

    // Statistiques des réservations
    const reservationStats = await Reservation.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 }
        }
      }
    ]);

    // Calculer les variations par rapport au mois précédent
    const previousThirtyDays = new Date(thirtyDaysAgo);
    previousThirtyDays.setDate(previousThirtyDays.getDate() - 30);

    const previousRevenueStats = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { 
            $gte: previousThirtyDays,
            $lt: thirtyDaysAgo
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' }
        }
      }
    ]);

    // Calculer les pourcentages de variation
    const calculateChange = (current, previous) => {
      if (!previous) return 0;
      return ((current - previous) / previous) * 100;
    };

    const currentRevenue = revenueStats[0]?.total || 0;
    const previousRevenue = previousRevenueStats[0]?.total || 0;
    const revenueChange = calculateChange(currentRevenue, previousRevenue);

    res.json({
      revenue: {
        total: currentRevenue,
        change: Math.round(revenueChange * 100) / 100
      },
      orders: {
        total: orderStats[0]?.total || 0,
        change: 0 // À implémenter si nécessaire
      },
      customers: {
        total: customerStats[0]?.total || 0,
        change: 0 // À implémenter si nécessaire
      },
      reservations: {
        total: reservationStats[0]?.total || 0,
        change: 0 // À implémenter si nécessaire
      }
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des statistiques:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
});

// Route pour obtenir les données de revenus
router.get('/revenue', [auth, isAdmin], async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueData = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$total" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(revenueData);
  } catch (err) {
    console.error('Erreur lors de la récupération des données de revenus:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des données de revenus' });
  }
});

// Route pour obtenir les données des commandes
router.get('/orders', [auth, isAdmin], async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orderData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(orderData);
  } catch (err) {
    console.error('Erreur lors de la récupération des données des commandes:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des données des commandes' });
  }
});

// Route pour obtenir tous les utilisateurs
router.get('/users', [auth, isAdmin], async (req, res) => {
  try {
    const users = await User.find({ role: 'client' }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// Route pour modifier le rôle d'un utilisateur
router.put('/users/:userId/role', [auth, isAdmin], async (req, res) => {
  try {
    const { role } = req.body;
    const { userId } = req.params;

    if (!['client', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (user._id.toString() === req.user.id && role !== 'admin') {
      return res.status(400).json({ message: 'Vous ne pouvez pas modifier votre propre rôle' });
    }

    user.role = role;
    await user.save();

    res.json({ message: 'Rôle mis à jour avec succès', user });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la modification du rôle' });
  }
});

module.exports = router;
