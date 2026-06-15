import React from 'react';
import { X } from 'lucide-react';

const ModalHeader = ({ icon: Icon, iconColor, children, onClose }) => (
  <div className="modal-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
    <h3 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
      {Icon && <Icon size={20} color={iconColor || 'var(--primary)'} />}
      {children}
    </h3>
    {onClose && (
      <button onClick={onClose} className="modal-close">
        <X size={18} />
      </button>
    )}
  </div>
);

const ModalBody = ({ children, style, ...props }) => (
  <div style={style} {...props}>{children}</div>
);

const ModalFooter = ({ children, align = 'flex-end', style, ...props }) => (
  <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: align, marginTop: '24px', ...style }} {...props}>
    {children}
  </div>
);

export const Modal = ({ show, onClose, title, icon, iconColor, size, children }) => {
  if (!show) return null;

  const widthMap = { sm: '420px', md: '520px', lg: '620px' };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div
        className="modal-content modal-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: widthMap[size] || widthMap.md }}
      >
        {title && (
          <ModalHeader icon={icon} iconColor={iconColor} onClose={onClose}>
            {title}
          </ModalHeader>
        )}
        {children}
      </div>
    </div>
  );
};

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;