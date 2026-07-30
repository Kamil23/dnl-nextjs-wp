import Avatar from "./avatar";
import Date from "./date";
import CoverImage from "./cover-image";
import Link from "next/link";

export default function PostPreview({
  title,
  coverImage,
  date,
  excerpt,
  author,
  uri,
}) {
  return (
    <div>
      <div className="mb-5">
        {coverImage && (
          <CoverImage title={title} coverImage={coverImage} uri={uri} />
        )}
      </div>
      <h3 className="text-base text-gray-800 mb-1 leading-snug">
        <Link
          href={uri}
          className="whitespace-nowrap overflow-hidden text-ellipsis block"
          dangerouslySetInnerHTML={{ __html: title }}
        ></Link>
      </h3>
      <div
        className="text-xs overflow-hidden h-[40px] text-gray-600 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: excerpt }}
      />
      {/* <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
        <Avatar author={author} />
        <Date dateString={date} />
      </div> */}

    </div>
  );
}
