const db = require('../config/database');

/**
 * Socket.io Service
 * Manages real-time communication between attendants and conversations
 */
class SocketService {
  /**
   * Setup Socket.io event handlers
   * @param {Object} io - Socket.io instance
   */
  static setup(io) {
    // Store for tracking online users and their connections
    const onlineUsers = new Map();
    const userConnections = new Map();

    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      /**
       * Handle user join
       * Registers user as online and stores connection info
       */
      socket.on('user_join', (data) => {
        const { userId, companyId } = data;

        if (!onlineUsers.has(companyId)) {
          onlineUsers.set(companyId, new Map());
        }

        onlineUsers.get(companyId).set(userId, {
          socketId: socket.id,
          joinedAt: new Date(),
          status: 'online'
        });

        if (!userConnections.has(userId)) {
          userConnections.set(userId, []);
        }
        userConnections.get(userId).push(socket.id);

        // Broadcast user online status to company
        io.to(`company_${companyId}`).emit('user_status_changed', {
          userId: userId,
          status: 'online',
          timestamp: new Date()
        });

        console.log(`User ${userId} joined company ${companyId}`);
      });

      /**
       * Handle join conversation room
       * User subscribes to conversation updates
       */
      socket.on('join_conversation', (data) => {
        const { conversationId, userId } = data;

        socket.join(`conversation_${conversationId}`);

        // Mark user as viewing conversation
        io.to(`conversation_${conversationId}`).emit('user_viewing', {
          conversationId: conversationId,
          userId: userId,
          timestamp: new Date()
        });

        console.log(`User ${userId} joined conversation ${conversationId}`);
      });

      /**
       * Handle leave conversation room
       */
      socket.on('leave_conversation', (data) => {
        const { conversationId, userId } = data;

        socket.leave(`conversation_${conversationId}`);

        io.to(`conversation_${conversationId}`).emit('user_left', {
          conversationId: conversationId,
          userId: userId,
          timestamp: new Date()
        });

        console.log(`User ${userId} left conversation ${conversationId}`);
      });

      /**
       * Handle new message event
       * Broadcast new message to conversation participants
       */
      socket.on('new_message', async (data) => {
        try {
          const { conversationId, leadId, userId, content, messageType = 'text' } = data;

          // Save message to database
          const [messageId] = await db('messages').insert({
            lead_id: leadId,
            sender_type: 'attendant',
            sender_id: userId,
            content: content,
            message_type: messageType,
            created_at: new Date(),
            updated_at: new Date()
          });

          // Broadcast to all users in conversation
          io.to(`conversation_${conversationId}`).emit('message_received', {
            conversationId: conversationId,
            messageId: messageId,
            leadId: leadId,
            userId: userId,
            content: content,
            messageType: messageType,
            timestamp: new Date()
          });

          console.log(`Message sent in conversation ${conversationId}`);
        } catch (error) {
          socket.emit('message_error', {
            error: error.message
          });
        }
      });

      /**
       * Handle typing indicator
       * Shows when a user is typing in a conversation
       */
      socket.on('typing', (data) => {
        const { conversationId, userId, isTyping } = data;

        // Broadcast typing status to conversation room
        io.to(`conversation_${conversationId}`).emit('user_typing', {
          conversationId: conversationId,
          userId: userId,
          isTyping: isTyping,
          timestamp: new Date()
        });
      });

      /**
       * Handle internal chat between attendants
       * Direct message between team members
       */
      socket.on('internal_chat', async (data) => {
        try {
          const { fromUserId, toUserId, message, conversationId } = data;

          // Save internal chat message
          const [chatId] = await db('internal_chats').insert({
            from_user_id: fromUserId,
            to_user_id: toUserId,
            conversation_id: conversationId,
            message: message,
            read: false,
            created_at: new Date()
          });

          // Get recipient's connections and emit to them
          const recipientConnections = userConnections.get(toUserId) || [];

          recipientConnections.forEach(socketId => {
            io.to(socketId).emit('internal_message_received', {
              chatId: chatId,
              fromUserId: fromUserId,
              toUserId: toUserId,
              message: message,
              conversationId: conversationId,
              timestamp: new Date()
            });
          });

          console.log(`Internal message from ${fromUserId} to ${toUserId}`);
        } catch (error) {
          socket.emit('chat_error', {
            error: error.message
          });
        }
      });

      /**
       * Handle mark conversation as read
       */
      socket.on('mark_read', async (data) => {
        try {
          const { conversationId, userId } = data;

          await db('messages')
            .where('lead_id', conversationId)
            .where('read_by', null)
            .update({
              read_by: userId,
              read_at: new Date()
            });

          io.to(`conversation_${conversationId}`).emit('conversation_read', {
            conversationId: conversationId,
            readBy: userId,
            timestamp: new Date()
          });
        } catch (error) {
          socket.emit('read_error', {
            error: error.message
          });
        }
      });

      /**
       * Handle user status change
       */
      socket.on('status_change', (data) => {
        const { userId, companyId, newStatus } = data;

        if (onlineUsers.has(companyId) && onlineUsers.get(companyId).has(userId)) {
          const userInfo = onlineUsers.get(companyId).get(userId);
          userInfo.status = newStatus;

          io.to(`company_${companyId}`).emit('user_status_changed', {
            userId: userId,
            status: newStatus,
            timestamp: new Date()
          });
        }
      });

      /**
       * Handle disconnect
       */
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);

        // Find and remove user from online list
        for (const [companyId, users] of onlineUsers.entries()) {
          for (const [userId, userInfo] of users.entries()) {
            if (userInfo.socketId === socket.id) {
              users.delete(userId);

              // Notify others that user is offline
              io.to(`company_${companyId}`).emit('user_status_changed', {
                userId: userId,
                status: 'offline',
                timestamp: new Date()
              });

              // Remove from user connections
              if (userConnections.has(userId)) {
                const connections = userConnections.get(userId);
                const index = connections.indexOf(socket.id);
                if (index > -1) {
                  connections.splice(index, 1);
                }
                if (connections.length === 0) {
                  userConnections.delete(userId);
                }
              }

              console.log(`User ${userId} is now offline`);
              break;
            }
          }
        }
      });

      /**
       * Get online users in company
       */
      socket.on('get_online_users', (data) => {
        const { companyId } = data;

        const companyUsers = onlineUsers.get(companyId);
        const usersList = companyUsers
          ? Array.from(companyUsers.entries()).map(([userId, info]) => ({
              userId: userId,
              status: info.status,
              joinedAt: info.joinedAt
            }))
          : [];

        socket.emit('online_users', {
          companyId: companyId,
          users: usersList
        });
      });

      /**
       * Handle error
       */
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });

    return {
      io: io,
      onlineUsers: onlineUsers,
      userConnections: userConnections
    };
  }

  /**
   * Emit event to specific conversation
   * @param {Object} io - Socket.io instance
   * @param {string} conversationId - Conversation ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  static emitToConversation(io, conversationId, event, data) {
    io.to(`conversation_${conversationId}`).emit(event, data);
  }

  /**
   * Emit event to specific company
   * @param {Object} io - Socket.io instance
   * @param {string} companyId - Company ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  static emitToCompany(io, companyId, event, data) {
    io.to(`company_${companyId}`).emit(event, data);
  }

  /**
   * Emit event to specific user
   * @param {Object} io - Socket.io instance
   * @param {string} userId - User ID
   * @param {Object} userConnections - Map of user connections
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  static emitToUser(io, userId, userConnections, event, data) {
    const connections = userConnections.get(userId) || [];
    connections.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
  }

  /**
   * Get count of online users in company
   * @param {string} companyId - Company ID
   * @param {Object} onlineUsers - Online users map
   * @returns {number} Count of online users
   */
  static getOnlineUserCount(companyId, onlineUsers) {
    const companyUsers = onlineUsers.get(companyId);
    return companyUsers ? companyUsers.size : 0;
  }

  /**
   * Check if user is online
   * @param {string} userId - User ID
   * @param {string} companyId - Company ID
   * @param {Object} onlineUsers - Online users map
   * @returns {boolean} True if user is online
   */
  static isUserOnline(userId, companyId, onlineUsers) {
    const companyUsers = onlineUsers.get(companyId);
    if (!companyUsers) return false;
    return companyUsers.has(userId);
  }
}

module.exports = SocketService;
