// server/services/wsServer.js
// WebSocket server for real-time client updates
// Efficiently broadcasts updates only to interested clients

import { WebSocketServer } from 'ws';
import * as db from './database.js';

// Configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CLIENT_TIMEOUT = 60000;     // 60 seconds

// State
let wss = null;
const clients = new Map(); // Map<ws, ClientState>

/**
 * Client state structure
 */
function createClientState() {
  return {
    id: Math.random().toString(36).substring(7),
    subscribedPools: new Set(),
    lastActivity: Date.now(),
    isAlive: true
  };
}

/**
 * Initialize WebSocket server
 */
export function init(server) {
  wss = new WebSocketServer({
    server,
    path: '/ws',
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      threshold: 1024 // Only compress messages > 1KB
    }
  });

  wss.on('connection', handleConnection);

  // Start heartbeat interval
  setInterval(heartbeat, HEARTBEAT_INTERVAL);

  console.log('[WSServer] WebSocket server initialized on /ws');
  return wss;
}

/**
 * Handle new client connection
 */
function handleConnection(ws, req) {
  const clientState = createClientState();
  clients.set(ws, clientState);

  console.log(`[WSServer] Client connected: ${clientState.id} (${clients.size} total)`);

  // Send initial welcome message
  send(ws, {
    type: 'connected',
    clientId: clientState.id,
    poolCount: parseInt(db.getMetadata('pool_count') || '0'),
    timestamp: Date.now()
  });

  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, clientState, message);
    } catch (err) {
      send(ws, { type: 'error', message: 'Invalid message format' });
    }
  });

  // Handle pong (heartbeat response)
  ws.on('pong', () => {
    clientState.isAlive = true;
    clientState.lastActivity = Date.now();
  });

  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WSServer] Client disconnected: ${clientState.id} (${clients.size} total)`);
  });

  // Handle errors
  ws.on('error', (err) => {
    console.warn(`[WSServer] Client error ${clientState.id}:`, err.message);
  });
}

/**
 * Handle incoming message from client
 */
function handleMessage(ws, clientState, message) {
  clientState.lastActivity = Date.now();

  switch (message.type) {
    case 'subscribe':
      handleSubscribe(ws, clientState, message);
      break;

    case 'unsubscribe':
      handleUnsubscribe(ws, clientState, message);
      break;

    case 'getTransactions':
      handleGetTransactions(ws, clientState, message);
      break;

    case 'ping':
      send(ws, { type: 'pong', timestamp: Date.now() });
      break;

    default:
      send(ws, { type: 'error', message: `Unknown message type: ${message.type}` });
  }
}

/**
 * Handle pool subscription request
 */
function handleSubscribe(ws, clientState, message) {
  const { pools } = message;

  if (!Array.isArray(pools)) {
    send(ws, { type: 'error', message: 'pools must be an array' });
    return;
  }

  // Limit subscriptions per client to prevent abuse
  const MAX_SUBSCRIPTIONS = 20;
  const toAdd = pools.slice(0, MAX_SUBSCRIPTIONS - clientState.subscribedPools.size);

  for (const poolAddress of toAdd) {
    clientState.subscribedPools.add(poolAddress);
  }

  // Send recent transactions for subscribed pools
  for (const poolAddress of toAdd) {
    const transactions = db.getPoolTransactions(poolAddress, 10);
    if (transactions.length > 0) {
      send(ws, {
        type: 'transactions',
        poolAddress,
        transactions
      });
    }
  }

  send(ws, {
    type: 'subscribed',
    pools: Array.from(clientState.subscribedPools),
    count: clientState.subscribedPools.size
  });
}

/**
 * Handle pool unsubscription request
 */
function handleUnsubscribe(ws, clientState, message) {
  const { pools } = message;

  if (pools === 'all') {
    clientState.subscribedPools.clear();
  } else if (Array.isArray(pools)) {
    for (const poolAddress of pools) {
      clientState.subscribedPools.delete(poolAddress);
    }
  }

  send(ws, {
    type: 'unsubscribed',
    pools: Array.from(clientState.subscribedPools),
    count: clientState.subscribedPools.size
  });
}

/**
 * Handle get transactions request
 */
function handleGetTransactions(ws, clientState, message) {
  const { poolAddress, limit = 10 } = message;

  if (!poolAddress) {
    send(ws, { type: 'error', message: 'poolAddress is required' });
    return;
  }

  const transactions = db.getPoolTransactions(poolAddress, Math.min(limit, 50));

  send(ws, {
    type: 'transactions',
    poolAddress,
    transactions
  });
}

/**
 * Send message to client
 */
function send(ws, data) {
  if (ws.readyState === 1) { // OPEN
    ws.send(JSON.stringify(data));
  }
}

/**
 * Broadcast transaction to interested clients
 */
export function broadcastTransaction(tx) {
  if (!wss) return;

  const message = JSON.stringify({
    type: 'transaction',
    transaction: tx
  });

  let broadcastCount = 0;

  for (const [ws, clientState] of clients) {
    if (clientState.subscribedPools.has(tx.poolAddress) && ws.readyState === 1) {
      ws.send(message);
      broadcastCount++;
    }
  }

  if (broadcastCount > 0) {
    console.log(`[WSServer] Broadcast tx to ${broadcastCount} clients for pool ${tx.poolAddress.slice(0, 8)}...`);
  }
}

/**
 * Broadcast pool update to all clients
 */
export function broadcastPoolUpdate(updateInfo) {
  if (!wss) return;

  const message = JSON.stringify({
    type: 'poolsUpdated',
    ...updateInfo,
    timestamp: Date.now()
  });

  let sentCount = 0;
  for (const [ws] of clients) {
    if (ws.readyState === 1) {
      ws.send(message);
      sentCount++;
    }
  }

  console.log(`[WSServer] Broadcast pool update to ${sentCount} clients`);
}

/**
 * Heartbeat to detect dead connections
 */
function heartbeat() {
  for (const [ws, clientState] of clients) {
    if (!clientState.isAlive) {
      console.log(`[WSServer] Terminating inactive client: ${clientState.id}`);
      clients.delete(ws);
      ws.terminate();
      continue;
    }

    // Check for inactive clients
    if (Date.now() - clientState.lastActivity > CLIENT_TIMEOUT) {
      console.log(`[WSServer] Terminating timed out client: ${clientState.id}`);
      clients.delete(ws);
      ws.terminate();
      continue;
    }

    clientState.isAlive = false;
    ws.ping();
  }
}

/**
 * Get connection statistics
 */
export function getStats() {
  let totalSubscriptions = 0;
  const poolSubscriptions = new Map();

  for (const [, clientState] of clients) {
    totalSubscriptions += clientState.subscribedPools.size;
    for (const pool of clientState.subscribedPools) {
      poolSubscriptions.set(pool, (poolSubscriptions.get(pool) || 0) + 1);
    }
  }

  return {
    connectedClients: clients.size,
    totalSubscriptions,
    uniquePoolsSubscribed: poolSubscriptions.size,
    topPools: Array.from(poolSubscriptions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  };
}

/**
 * Close all connections and shutdown
 */
export function shutdown() {
  if (!wss) return;

  // Close all client connections
  for (const [ws] of clients) {
    ws.close(1001, 'Server shutting down');
  }

  clients.clear();
  wss.close();
  wss = null;

  console.log('[WSServer] WebSocket server shut down');
}

export default {
  init,
  broadcastTransaction,
  broadcastPoolUpdate,
  getStats,
  shutdown
};
