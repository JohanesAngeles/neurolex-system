import React, { useState, useEffect, useRef } from 'react';
import notificationService from '../../services/notificationService';
import { getSocket } from '../../services/socketService';
import '../../styles/components/dashboard/notification.css';

const NotificationPanel = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      setupSocketListeners();
    }
    
    // Click outside handler to close panel
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [user]);

  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('newNotification', (notification) => {
      console.log('New notification received:', notification);
      // Add to notifications list
      setNotifications(prev => [notification, ...prev]);
      // Increment unread count
      setUnreadCount(prev => prev + 1);
    });

    socket.on('notificationRead', (notificationId) => {
      console.log('Notification marked as read:', notificationId);
      // Update notification in the list
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? {...n, read: true} : n)
      );
    });

    socket.on('allNotificationsRead', () => {
      console.log('All notifications marked as read');
      // Update all notifications in the list
      setNotifications(prev => 
        prev.map(n => ({...n, read: true}))
      );
      setUnreadCount(0);
    });

    return () => {
      socket.off('newNotification');
      socket.off('notificationRead');
      socket.off('allNotificationsRead');
    };
  };

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
      
      // Calculate unread count
      const unread = data.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const toggleNotificationPanel = () => {
    setIsOpen(!isOpen);
  };

  const markAsRead = async (notificationId) => {
    try {
      // Optimistic UI update
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? {...n, read: true} : n)
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Call API
      await notificationService.markAsRead(notificationId);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Revert on error
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      // Optimistic UI update
      setNotifications(prev => prev.map(n => ({...n, read: true})));
      setUnreadCount(0);
      
      // Call API
      await notificationService.markAllAsRead();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      // Revert on error
      fetchNotifications();
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-container" ref={panelRef}>
      {/* Notification Icon */}
      <div className="notification-icon-wrapper" onClick={toggleNotificationPanel}>
        <div className="notification-icon">
          {/* Replace with your notification icon */}
          🔔
        </div>
        {unreadCount > 0 && (
          <div className="notification-badge">{unreadCount}</div>
        )}
      </div>
      
      {/* Notification Panel */}
      {isOpen && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="mark-all-read">
                Mark all as read
              </button>
            )}
          </div>
          
          {error && (
            <div className="notification-error">{error}</div>
          )}
          
          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">Loading...</div>
            ) : notifications.length > 0 ? (
              notifications.map(notification => (
                <div 
                  key={notification._id} 
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => markAsRead(notification._id)}
                >
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {formatRelativeTime(notification.createdAt)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-notifications">
                <p>No notifications to display</p>
              </div>
            )}
          </div>
          
          <div className="notification-footer">
            <button onClick={fetchNotifications} className="refresh-button">
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;