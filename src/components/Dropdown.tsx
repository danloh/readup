import clsx from 'clsx';
import React, { useState, isValidElement, ReactElement } from 'react';
import { Overlay } from './Overlay';

interface DropdownProps {
  label?: string;
  className?: string;
  menuClassName?: string;
  buttonClassName?: string;
  toggleButton: React.ReactNode;
  children: ReactElement<{ setIsDropdownOpen: (isOpen: boolean) => void; menuClassName?: string }>;
  disabled?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  label = '',
  className,
  menuClassName,
  buttonClassName,
  toggleButton,
  children,
  disabled,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onToggle?.(newIsOpen);
  };

  const setIsDropdownOpen = (isOpen: boolean) => {
    if (disabled) return;
    setIsOpen(isOpen);
    onToggle?.(isOpen);
  };

  const childrenWithToggle = isValidElement(children)
    ? React.cloneElement(children, { setIsDropdownOpen, menuClassName })
    : children;

  return (
    <div className='dropdown-container flex'>
      {isOpen && (<Overlay onDismiss={() => setIsDropdownOpen(false)} />)}
      <div
        tabIndex={0}
        role='button'
        aria-label={'Menu'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (!isOpen) toggleDropdown();
          } else if (e.key === 'Escape' && isOpen) {
            toggleDropdown();
          } else {
            e.stopPropagation();
          }
        }}
        className={clsx('dropdown', className)}
      >
        <div
          title={label}
          tabIndex={-1}
          onClick={toggleDropdown}
          className={clsx(
            'dropdown-toggle touch-target', 
            buttonClassName, isOpen && 'bg-base-300/50'
          )}
        >
          {toggleButton}
        </div>
        {isOpen && childrenWithToggle}
      </div>
    </div>
  );
};

export default Dropdown;
