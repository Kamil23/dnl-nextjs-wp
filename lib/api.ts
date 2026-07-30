const API_URL = process.env.WORDPRESS_API_URL;

async function fetchAPI(query = "", { variables }: Record<string, any> = {}) {
  const headers = { "Content-Type": "application/json" };

  if (process.env.WORDPRESS_AUTH_REFRESH_TOKEN) {
    headers[
      "Authorization"
    ] = `Bearer ${process.env.WORDPRESS_AUTH_REFRESH_TOKEN}`;
  }

  // WPGraphQL Plugin must be enabled
  const res = await fetch(API_URL, {
    headers,
    method: "POST",
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error(json.errors);
    throw new Error("Failed to fetch API");
  }
  return json.data;
}

const POST_FIELDS_FRAGMENT = `
  fragment AuthorFields on User {
    name
    firstName
    lastName
    avatar {
      url
    }
  }
  fragment PostFields on Post {
    title
    excerpt
    slug
    uri
    date
    modified
    id
    featuredImage {
      node {
        sourceUrl
      }
    }
    author {
      node {
        ...AuthorFields
      }
    }
    link
    categories {
      edges {
        node {
          name
          link
          id
          uri
          parentId
        }
      }
    }
    tags {
      edges {
        node {
          name
        }
      }
    }
  }
`;

export async function getPreviewPost(id, idType = "DATABASE_ID") {
  const data = await fetchAPI(
    `
    query PreviewPost($id: ID!, $idType: PostIdType!) {
      post(id: $id, idType: $idType) {
        databaseId
        slug
        uri
        status
      }
    }`,
    {
      variables: { id, idType },
    }
  );
  return data.post;
}

export async function getAllPostUris() {
  // WPGraphQL caps a single page at 100 items, so walk the cursor
  const edges = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await fetchAPI(
      `
      query AllPostUris($after: String) {
        posts(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              uri
              modified
            }
          }
        }
      }
    `,
      { variables: { after } }
    );
    edges.push(...data.posts.edges);
    hasNextPage = data.posts.pageInfo.hasNextPage;
    after = data.posts.pageInfo.endCursor;
  }

  return { edges };
}

export async function getAllCategoriesWithUri() {
  const data = await fetchAPI(`
    {
      categories(first: 100) {
        edges {
          node {
            uri
            count
          }
        }
      }
    }
  `);
  return data?.categories;
}

const LISTING_NODE_FIELDS = `
  title
  excerpt
  slug
  uri
  date
  featuredImage {
    node {
      sourceUrl
    }
  }
  author {
    node {
      name
      firstName
      lastName
      avatar {
        url
      }
    }
  }
`;

// Walks the cursor to collect every matching post (WPGraphQL caps a page at 100)
async function getAllListingPosts(categorySlug: string | null = null) {
  const edges = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await fetchAPI(
      `
      query ListingPosts($after: String, $categoryName: String) {
        posts(first: 100, after: $after, where: { categoryName: $categoryName, orderby: { field: DATE, order: DESC } }) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              ${LISTING_NODE_FIELDS}
            }
          }
        }
      }
    `,
      { variables: { after, categoryName: categorySlug } }
    );
    edges.push(...data.posts.edges);
    hasNextPage = data.posts.pageInfo.hasNextPage;
    after = data.posts.pageInfo.endCursor;
  }

  return edges;
}

// All posts for the homepage listing, paginated in the page components
export async function getAllPostsForHome() {
  const edges = await getAllListingPosts();
  return { edges };
}

export async function getPostsByCategorySlug(slug) {
  const [edges, catData] = await Promise.all([
    getAllListingPosts(slug),
    fetchAPI(
      `
      query GET_CATEGORY($slugs: [String]) {
        categories(where: {slug: $slugs}) {
          edges {
            node {
              name
              uri
              slug
            }
          }
        }
      }
    `,
      { variables: { slugs: [slug] } }
    ),
  ]);

  return { posts: { edges }, categories: catData.categories };
}

export async function getPostsForFeed() {
  const data = await fetchAPI(`
    {
      posts(first: 10, where: { orderby: { field: DATE, order: DESC } }) {
        edges {
          node {
            title
            excerpt
            content
            slug
            uri
            date
            author {
              node {
                name
              }
            }
            categories {
              edges {
                node {
                  name
                }
              }
            }
          }
        }
      }
    }
  `);
  return data?.posts;
}

// Resolves a WP permalink to either a Post or a static Page
export async function getContentByUri(uri) {
  const data = await fetchAPI(
    `
    ${POST_FIELDS_FRAGMENT}
    query ContentByUri($uri: String!) {
      nodeByUri(uri: $uri) {
        __typename
        ... on Post {
          ...PostFields
          content
        }
        ... on Page {
          title
          content
          slug
          uri
          date
          modified
        }
      }
      posts(first: 5, where: { orderby: { field: DATE, order: DESC } }) {
        edges {
          node {
            ...PostFields
          }
        }
      }
    }
  `,
    {
      variables: { uri },
    }
  );

  const node = data?.nodeByUri;

  if (node?.__typename === "Post") {
    // Drop the current post from the "more posts" list
    data.posts.edges = data.posts.edges
      .filter(({ node: n }) => n.uri !== node.uri)
      .slice(0, 4);
  }

  return { node, posts: data?.posts };
}

export async function getAllPageUris() {
  const data = await fetchAPI(`
    {
      pages(first: 100) {
        edges {
          node {
            uri
          }
        }
      }
    }
  `);
  return data?.pages;
}

export const getMenu = async () => {
  const data = await fetchAPI(
    `
    query GET_MENU_ITEMS {
      menuItems {
        edges {
          node {
            id
            label
            childItems {
              edges {
                node {
                  id
                  label
                  path
                }
              }
            }
            parentId
            path
          }
        }
      }
    }`,
    {}
  );
  return data;
};
