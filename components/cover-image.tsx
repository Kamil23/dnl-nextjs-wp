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
  slug?: string;
}

export default function CoverImage({ title, coverImage, slug }: Props) {
  const image = (
      <Image
      fill
        alt={`Zdjęcie poglądowe dla ${title}`}
        src={coverImage?.node.sourceUrl}
        className={cn(`shadow-small ${!slug ? "object-cover contrast-125 rounded-lg" : ""}`, {
          "hover:shadow-medium transition-shadow duration-200 rounded-lg object-cover contrast-125": slug,
        })}
      />
  );
  return (
    <div className={`sm:mx-0 ${!slug ? "relative flex w-full h-[100vw] sm:h-[50vw] md:h-[31vw] lg:h-[22vw]" : ""} `}>
      {slug ? (
        <Link className="relative flex h-[100vw] sm:h-[50vw] md:h-[31vw] lg:h-[22vw]" href={`/przepis/${slug}`} aria-label={title}>
          {image}
        </Link>
      ) : (
        image
      )}
    </div>
  );
}
