const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Root greeting
app.get('/', (req, res) => {
  res.json({
    message: 'Beet Voice Meal Logger API is running.',
    version: '1.0.0',
    documentation: '/api/foods, /api/meals, /api/livekit/token',
  });
});

module.exports = app;
