const express = require('express');
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

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

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
