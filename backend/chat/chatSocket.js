module.exports = (io, db) => {
  
  io.on('connection', (socket) => {
      console.log('📡 New client connected:', socket.id);
      socket.on('message', (data) => {
          console.log('💬 Message received:', data);
          io.emit('message', data); // Broadcast message to all clients
      });
  });
};
