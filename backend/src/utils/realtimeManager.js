const clients = new Set();

/**
 * Add a new SSE client connection.
 * @param {string} userId 
 * @param {string} role 
 * @param {object} res Express response object
 */
const addClient = (userId, role, res) => {
  const client = { userId, role, res };
  clients.add(client);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection OK event
  sendSSE(res, 'connected', { status: 'connected', userId });

  // Handle client disconnect
  res.on('close', () => {
    clients.delete(client);
  });
};

/**
 * Helper to format and send SSE data.
 */
const sendSSE = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * Send event to a specific user.
 */
const sendEventToUser = (userId, event, data) => {
  for (const client of clients) {
    if (client.userId === userId) {
      sendSSE(client.res, event, data);
    }
  }
};

/**
 * Send event to multiple roles (e.g., ['admin', 'hrd']).
 */
const sendEventToRoles = (roles, event, data) => {
  for (const client of clients) {
    if (roles.includes(client.role)) {
      sendSSE(client.res, event, data);
    }
  }
};

/**
 * Broadcast event to all connected clients.
 */
const broadcastEvent = (event, data) => {
  for (const client of clients) {
    sendSSE(client.res, event, data);
  }
};

// Keepalive: send keepalive comments every 30 seconds to keep connections open
setInterval(() => {
  for (const client of clients) {
    client.res.write(':keepalive\n\n');
  }
}, 30000);

module.exports = {
  addClient,
  sendEventToUser,
  sendEventToRoles,
  broadcastEvent
};
