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
  slug,
}) {
  return (
    <div>
      <div className="mb-5">
        {coverImage && (
          <CoverImage title={title} coverImage={coverImage} slug={slug} />
        )}
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-3 leading-snug">
        <Link
          href={`/przepis/${slug}`}
          className="whitespace-nowrap overflow-hidden text-ellipsis block"
          dangerouslySetInnerHTML={{ __html: title }}
        ></Link>
      </h3>
      <div
        className="text-sm overflow-hidden h-[50px] text-gray-600 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: excerpt }}
      />
      <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
        <Avatar author={author} />
        <Date dateString={date} />
      </div>
      
    </div>
  );
}
