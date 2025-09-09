import clsx from 'clsx';
import { ReactNode } from 'react';
import ReactDOM from 'react-dom';

interface PortalProps {
  children: ReactNode;
  selector?: string;
  showOverlay?: boolean;
}

export function Portal({ children, selector, showOverlay = true }: PortalProps) {
  return ReactDOM.createPortal(
    <div
      className={clsx(
        'fixed inset-0 isolate z-[100] flex items-center justify-center',
        showOverlay && 'bg-black bg-opacity-50',
      )}
      style={{ transform: 'translateZ(0)' }}
    >
      {children}
    </div>,
    selector ? document.querySelector(selector) || document.body : document.body,
  );
};
