import clsx from 'clsx';
import { useRef } from 'react';
import { useKeyDownActions } from '@/hooks/useKeyDownActions';

interface MenuProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  onCancel?: () => void;
}

const Menu: React.FC<MenuProps> = ({ children, className, style, onCancel }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  useKeyDownActions({ onCancel, elementRef: menuRef });

  return (
    <div
      ref={menuRef}
      role='none'
      className={clsx(
        'menu-container max-h-[calc(100vh-96px)] overflow-y-auto border-0', 
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
};

export default Menu;
