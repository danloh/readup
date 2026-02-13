import Image from 'next/image';

type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export default function Logo(props: Props) {
  const { width=24, height=24, className='' } = props;
  return (
    <Image
      src={'/favicon.svg'}
      width={width}
      height={height}
      alt=''
      priority={true}
      className={className}
    />
  );
}
