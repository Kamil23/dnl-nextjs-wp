import PostPreview from './post-preview'

export default function MoreStories({ posts }) {
  return (
    <section>
      {/* <h2 className="mb-8 text-6xl md:text-7xl text-gray-800 font-bold tracking-tighter leading-tight">
        More Stories
      </h2> */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-4 mb-32">
        {posts.map(({ node }) => (
          <PostPreview
            key={node.slug}
            title={node.title}
            coverImage={node.featuredImage}
            date={node.date}
            author={node.author}
            slug={node.slug}
            excerpt={node.excerpt}
          />
        ))}
      </div>
    </section>
  )
}
