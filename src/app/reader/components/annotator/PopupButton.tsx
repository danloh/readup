import clsx from 'clsx';

interface PopupButtonProps {
  showTooltip: boolean;
  tooltipText: string;
  disabled?: boolean;
  Icon: React.ElementType;
  onClick: () => void;
}

const PopupButton: React.FC<PopupButtonProps> = ({
  showTooltip,
  tooltipText,
  disabled,
  Icon,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex h-8 min-h-8 w-8 items-center justify-center p-0',
        disabled ? 'cursor-not-allowed opacity-50' : 'rounded-md hover:bg-gray-500',
      )}
      disabled={disabled}
      title={showTooltip ? tooltipText : ''}
    >
      <Icon />
    </button>
  );
};

export default PopupButton;
