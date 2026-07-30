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

export async function getAllPostsForHome(preview) {
  const data = await fetchAPI(
    `
    query AllPosts {
      posts(first: 20, where: { orderby: { field: DATE, order: DESC } }) {
        edges {
          node {
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
          }
        }
      }
    }
  `,
    {
      variables: {
        onlyEnabled: !preview,
        preview,
      },
    }
  );

  return data?.posts;
}

export async function getPostsByCategorySlug(slug) {
  const data = await fetchAPI(`
  query GET_POSTS_BY_CATEGORY($slug: String, $slugs: [String]) {
    posts(first: 100, where: {categoryName: $slug, orderby: { field: DATE, order: DESC }}) {
      edges {
        node {
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
        }
      }
    },
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
  `, {
    variables: {
      slug,
      slugs: [slug],
    },
  })
  return data;
}

export async function getPostByUri(uri) {
  const data = await fetchAPI(
    `
    ${POST_FIELDS_FRAGMENT}
    query PostByUri($id: ID!) {
      post(id: $id, idType: URI) {
        ...PostFields
        content
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
      variables: { id: uri },
    }
  );

  if (data?.post) {
    // Drop the current post from the "more posts" list
    data.posts.edges = data.posts.edges
      .filter(({ node }) => node.uri !== data.post.uri)
      .slice(0, 4);
  }

  return data;
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
