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
  // białko na porcję (g) - plakietka w rogu zdjęcia; ukryta gdy brak danych
  protein?: number | null;
}

export default function CoverImage({ title, coverImage, uri, protein }: Props) {
  const image = (
      <Image
      fill
        alt={`Zdjęcie poglądowe dla ${title}`}
        src={coverImage?.node.sourceUrl ? coverImage.node.sourceUrl : undefined}
        className={`shadow-small object-cover contrast-125 rounded-lg ${
          uri ? "hover:shadow-medium transition-shadow duration-200" : ""
        }`}
      />
  );
  const badge = protein ? (
    <span className="absolute top-2 right-2 z-10 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-bottomSmall">
      💪 {protein} g białka
    </span>
  ) : null;
  return (
    <div className={`sm:mx-0 ${!uri ? "relative flex w-full h-[100vw] sm:h-[50vw] md:h-[31vw] lg:h-[22vw]" : ""} `}>
      {uri ? (
        <Link className="relative flex h-[100vw] sm:h-[50vw] md:h-[31vw] lg:h-[22vw]" href={uri} aria-label={title}>
          {image}
          {badge}
        </Link>
      ) : (
        <>
          {image}
          {badge}
        </>
      )}
    </div>
  );
}
