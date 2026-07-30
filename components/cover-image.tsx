import cn from "classnames";
import Image from "next/image";
import Link from "next/link";

interface Props {
  title: string;
  coverImage: {
    node: {
      sourceUrl: string;
    };
  };
  uri?: string;
}

export default function CoverImage({ title, coverImage, uri }: Props) {
  const image = (
      <Image
      fill
        alt={`Zdjęcie poglądowe dla ${title}`}
        src={coverImage?.node.sourceUrl}
        className={cn(`shadow-small ${!uri ? "object-cover contrast-125 rounded-lg" : ""}`, {
          "hover:shadow-medium transition-shadow duration-200 rounded-lg object-cover contrast-125": uri,
        })}
      />
  );
  return (
    <div className={`sm:mx-0 ${!uri ? "relative flex w-full h-[100vw] sm:h-[50vw] md:h-[31vw] lg:h-[22vw]" : ""} `}>
      {uri ? (
        <Link className="relative flex h-[100vw] sm:h-[50vw] md:h-[31vw] lg:h-[22vw]" href={uri} aria-label={title}>
          {image}
        </Link>
      ) : (
        image
      )}
    </div>
  );
}
