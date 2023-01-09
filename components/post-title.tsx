export default function PostTitle({ children }) {
  return (
    <h1
      className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-tight md:leading-none mt-12 mb-4 text-center md:text-left"
      dangerouslySetInnerHTML={{ __html: children }}
    />
  )
}
