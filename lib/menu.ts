// Site navigation, frozen from the old WP menu (shape matches the former
// WPGraphQL menuItems response so <Intro/> stays unchanged).
// Becomes admin-editable when the panel lands.

const item = (id: string, label: string, path: string, parentId: string | null = null) => ({
  node: { id, label, path, parentId, childItems: { edges: [] } },
});

export const MENU_EDGES = [
  {
    node: {
      id: "cG9zdDoyOA==",
      label: "Przepisy",
      path: "/kategoria/przepisy/",
      parentId: null,
      childItems: {
        edges: [
          item("cG9zdDo3NjU=", "Śniadania", "/kategoria/przepisy/sniadania/", "cG9zdDoyOA=="),
          item("cG9zdDo4Nzg=", "Fit słodycze", "/kategoria/przepisy/fit-slodycze/", "cG9zdDoyOA=="),
          item("cG9zdDo3NjI=", "Fit ciasta", "/kategoria/przepisy/fit-ciasta/", "cG9zdDoyOA=="),
          item("cG9zdDo3NjQ=", "Obiad", "/kategoria/przepisy/obiad/", "cG9zdDoyOA=="),
          item("cG9zdDo3NjY=", "Wypieki", "/kategoria/przepisy/wypieki/", "cG9zdDoyOA=="),
          item("cG9zdDo3NjM=", "Jednoporcjowe", "/kategoria/przepisy/jednoporcjowe/", "cG9zdDoyOA=="),
        ],
      },
    },
  },
  item("cG9zdDo3NTQ=", "Artykuły", "/kategoria/artykuly/"),
  item("cG9zdDoxMjk0", "Kalkulator kalorii", "/kalkulator-kalorii/"),
  item("cG9zdDo3NTk=", "Do pobrania", "/do-pobrania/"),
];

// Same wrapper shape as the old getMenu() GraphQL response
export const MENU = { menuItems: { edges: MENU_EDGES } };
