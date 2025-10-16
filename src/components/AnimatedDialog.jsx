import React from 'react';
import { Dialog, Slide } from '@mui/material';

// Reusable Animated Dialog Component with bounce-in animation
const AnimatedDialog = ({
  children,
  open,
  onClose,
  maxWidth = "sm",
  fullWidth = true,
  ...props
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth={maxWidth}
    fullWidth={fullWidth}
    TransitionComponent={Slide}
    TransitionProps={{
      direction: 'up',
      timeout: 400,
    }}
    PaperProps={{
      sx: {
        borderRadius: 4,
        boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        animation: open ? 'dialogBounceIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)' : 'none',
        '@keyframes dialogBounceIn': {
          '0%': {
            opacity: 0,
            transform: 'scale(0.3) translateY(50px)',
          },
          '50%': {
            opacity: 0.9,
            transform: 'scale(1.05) translateY(-10px)',
          },
          '70%': {
            transform: 'scale(0.98) translateY(2px)',
          },
          '100%': {
            opacity: 1,
            transform: 'scale(1) translateY(0)',
          },
        },
      }
    }}
    {...props}
  >
    {children}
  </Dialog>
);

export default AnimatedDialog;