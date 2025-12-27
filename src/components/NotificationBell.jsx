import React, { useState, useContext, useRef } from 'react';
import { useNotifications } from '../context/NotificationContext';
import NotificationCenter from './NotificationCenter';
import Draggable from 'react-draggable';
import './NotificationBell.css';

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const nodeRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const toggleNotifications = () => {
    if (!isDragging) {
      setIsOpen(!isOpen);
    }
  };

  const handleDragStart = () => {
    setIsDragging(false);
  };

  const handleDrag = () => {
    setIsDragging(true);
  };

  const handleDragStop = () => {
    // Keep dragging state for a brief moment to prevent click
    setTimeout(() => setIsDragging(false), 100);
  };

  return (
    <>
      <Draggable 
        nodeRef={nodeRef} 
        bounds="body" 
        defaultPosition={{ x: 0, y: 0 }}
        onStart={handleDragStart}
        onDrag={handleDrag}
        onStop={handleDragStop}
      >
        <div className="notification-bell-container" ref={nodeRef}>
          <button 
            className="notification-bell"
            onClick={toggleNotifications}
            aria-label="Notifications"
          >
            <svg 
              width="28" 
              height="28" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 2C13.1 2 14 2.9 14 4C14 4.1 14 4.2 14 4.3C16.4 5.1 18 7.4 18 10V16L20 18V19H4V18L6 16V10C6 7.4 7.6 5.1 10 4.3C10 4.2 10 4.1 10 4C10 2.9 10.9 2 12 2ZM10 21C10 22.1 10.9 23 12 23S14 22.1 14 21H10Z"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>
        </div>
      </Draggable>

      {isOpen && (
        <div className="notification-overlay">
          <div className="notification-panel">
            <div className="notification-panel-header">
              <h3>Notifications</h3>
              <button 
                className="close-notifications"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
            <NotificationCenter />
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
