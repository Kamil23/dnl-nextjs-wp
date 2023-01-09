import Head from 'next/head'
import { GetStaticProps } from 'next'
import Container from '../components/container'
import MoreStories from '../components/more-stories'
import HeroPost from '../components/hero-post'
import Intro from '../components/intro'
import Layout from '../components/layout'
import { getAllPostsForHome, getMenu } from '../lib/api'
import { SITE_DESCRIPTION, SITE_TITLE } from '../lib/constants'

export default function Index({ allPosts: { edges }, menu, preview }) {
  const heroPost = edges[0]?.node
  const morePosts = edges.slice(1)
  const menuItems = menu?.menuItems?.edges;

  return (
    <Layout menu={menuItems} preview={preview}>
      <Head>
        <title>{SITE_TITLE} - {SITE_DESCRIPTION}</title>
      </Head>
      <Container>
        {/* {heroPost && (
          <HeroPost
            title={heroPost.title}
            coverImage={heroPost.featuredImage}
            date={heroPost.date}
            author={heroPost.author}
            slug={heroPost.slug}
            excerpt={heroPost.excerpt}
          />
        )} */}
        {morePosts.length > 0 && <MoreStories posts={edges} />}
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({ preview = false }) => {
  const allPosts = await getAllPostsForHome(preview)
  const menu = await getMenu();

  return {
    props: { allPosts, menu, preview },
    revalidate: 10,
  }
}
