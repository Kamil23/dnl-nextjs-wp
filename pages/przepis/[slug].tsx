import { useRouter } from 'next/router'
import ErrorPage from 'next/error'
import Head from 'next/head'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import PostBody from '../../components/post-body'
import MoreStories from '../../components/more-stories'
import PostHeader from '../../components/post-header'
import SectionSeparator from '../../components/section-separator'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import Tags from '../../components/tags'
import { getAllPostsWithSlug, getMenu, getPostAndMorePosts } from '../../lib/api'
import ShareBtns from '../../components/share-btns'
import Breadcrumbs from '../../components/breadcrumbs'

export default function Post({ post, posts, menu, preview }) {
  debugger;
  const router = useRouter()
  const morePosts = posts?.edges;
  const menuItems = menu?.menuItems?.edges;

  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />
  }

  debugger;

  return (
    <Layout menu={menuItems} preview={preview}>
      <Container>
        {/* <Header /> */}
        {router.isFallback ? (
          <PostTitle>Loading…</PostTitle>
        ) : (
          <>
            <article>
              <Head>
                <title>
                  {post.title} - Dieta na luzie
                </title>
                <meta
                  property="og:image"
                  content={post.featuredImage?.node.sourceUrl}
                />
              </Head>
              <Breadcrumbs categories={post?.categories?.edges} title={post.title} />
              <PostHeader
                title={post.title}
                coverImage={post.featuredImage}
                date={post.date}
                author={post.author}
                categories={post.categories}
              />
              <PostBody content={post.content} />
              <footer>
                {post.tags.edges.length > 0 && <Tags tags={post.tags} />}
              </footer>
              <ShareBtns url={post.link} mediaUrl={post.featuredImage.node.sourceUrl} title={post.title} />
            </article>

            <SectionSeparator />
            {morePosts.length > 0 && <MoreStories posts={morePosts} />}
          </>
        )}
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({
  params,
  preview = false,
  previewData,
}) => {
  const data = await getPostAndMorePosts(params?.slug, preview, previewData);
  const menu = await getMenu();

  return {
    props: {
      preview,
      post: data.post,
      posts: data.posts,
      menu,
    },
    revalidate: 10,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const allPosts = await getAllPostsWithSlug()
  console.log(allPosts.edges.map(({ node }) => `/przepis/${node.slug}`) || [])

  return {
    paths: allPosts.edges.map(({ node }) => `/przepis/${node.slug}`) || [],
    fallback: true,
  }
}
