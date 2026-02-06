import clsx from 'clsx';
import { useState } from 'react';

interface PopupButtonProps {
  showTooltip: boolean;
  tooltipText: string;
  Icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const PopupButton: React.FC<PopupButtonProps> = ({
  showTooltip,
  tooltipText,
  Icon,
  onClick,
  disabled,
  className,
}) => {
  const [buttonClicked, setButtonClicked] = useState(false);
  const handleClick = () => {
    setButtonClicked(true);
    onClick();
  };
  
  return (
    <button
      onClick={handleClick}
      aria-label={tooltipText}
      className={clsx(
        'flex h-8 min-h-8 w-8 items-center justify-center p-0',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'not-eink:hover:bg-gray-500 eink:hover:border rounded-md',
        className || '',
      )}
      disabled={disabled}
      title={!buttonClicked && showTooltip ? tooltipText : undefined}
    >
      <Icon />
    </button>
  );
};

export default PopupButton;
