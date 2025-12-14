import Image from 'next/image';

type Props = {
  width?: number;
  height?: number;
};

export default function Logo(props: Props) {
  const { width=24, height=24 } = props;
  return (
    <Image
      src={'/favicon.svg'}
      width={width}
      height={height}
      alt=''
      priority={true}
    />
  );
}
