# api/logger.py
import logging
from logging.handlers import RotatingFileHandler
import os

def setup_audit_logger():
    """
    Sets up a dedicated logger for admin actions.
    """
    # Create logs directory if it doesn't exist
    if not os.path.exists('logs'):
        os.makedirs('logs')

    logger = logging.getLogger('audit')
    # Prevent log messages from being propagated to the root logger
    logger.propagate = False
    
    # Set level to INFO to capture all audit logs
    logger.setLevel(logging.INFO)

    # Only add handlers if they haven't been added already
    if not logger.handlers:
        # Create a file handler which logs even debug messages
        # Use RotatingFileHandler to keep log files from growing too large
        handler = RotatingFileHandler(
            'logs/admin_actions.log', maxBytes=1024 * 1024, backupCount=5, encoding='utf-8'
        )
        formatter = logging.Formatter('%(asctime)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    return logger

audit_log = setup_audit_logger()
