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
import { getPostsByCategoryUri, getMenu, getAllCategoriesWithUri } from '../../lib/api'
import ShareBtns from '../../components/share-btns'
import Breadcrumbs from '../../components/breadcrumbs'

export default function CategoryPosts({ posts, menu, preview }) {
  debugger;
  const router = useRouter()
  const morePosts = posts?.edges;
  const menuItems = menu?.menuItems?.edges;

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
                  List - Dieta na luzie
                </title>
                {/* <meta
                  property="og:image"
                  content={post.featuredImage?.node.sourceUrl}
                /> */}
              </Head>
              {/* <Breadcrumbs categories={post?.categories?.edges} title={post.title} />
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
              <ShareBtns url={post.link} mediaUrl={post.featuredImage.node.sourceUrl} title={post.title} /> */}
            </article>

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
  console.log("params: ", JSON.stringify(params));
  const uri = Array.isArray(params.uri) ? params.uri.join('/') : params.uri[0];
  const data = await getPostsByCategoryUri(uri);
  console.log(JSON.stringify(data.posts));
  const menu = await getMenu();

  return {
    props: {
      preview,
      posts: data.posts,
      menu,
    },
    revalidate: 10,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const allCategories = await getAllCategoriesWithUri();
  const paths = allCategories.edges.map(({ node }) => node.uri.slice(0, -1)) || []
  console.log(paths);

  return {
    paths: allCategories.edges.map(({ node }) => `${node.uri.slice(0, -1)}`) || [],
    fallback: true,
  }
}
