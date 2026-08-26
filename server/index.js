const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const apiRoutes = require('./routes/api');
const socketHandler = require('./routes/socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Gzip compression
app.use(compression());
app.use(express.json());

// Static files with caching
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

// Cache sprites aggressively (they don't change)
app.use('/display/sprites', express.static(path.join(__dirname, '..', 'public', 'display', 'sprites'), {
  maxAge: '7d'
}));
app.use('/player/sprites', express.static(path.join(__dirname, '..', 'public', 'player', 'sprites'), {
  maxAge: '7d'
}));

// Routes
app.use('/api', apiRoutes);

// Socket.IO
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socketHandler(io, socket);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║     🏰  Dungeon Quizzers Server Running     ║
  ║                                          ║
  ║  🌐 http://localhost:${PORT}              ║
  ║                                          ║
  ║  📱 Player: http://localhost:${PORT}/player ║
  ║  🖥️  Display: http://localhost:${PORT}/display ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
