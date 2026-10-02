import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // "/" on Lovable; the GitHub Pages copy is served from /beer-review-buddy/.
    basepath: import.meta.env.BASE_URL,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
