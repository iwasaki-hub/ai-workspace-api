/**
 * Available API resources for the public homepage.
 * Only add an entry after its GET endpoint has been implemented and verified.
 * Keep this display registry separate from MongoDB and API router concerns.
 */
export const publicResources = Object.freeze([
  Object.freeze({
    path: "/api/users",
    label: "ユーザー",
    description: "公開デモユーザーの一覧",
    icon: "users",
    countEndpoint: "/api/users",
    maxDisplayedCount: 50,
  }),
  Object.freeze({
    path: "/api/todos",
    label: "ToDo",
    description: "公開デモToDoの一覧",
    icon: "todo",
    countEndpoint: "/api/todos",
    maxDisplayedCount: 50,
  }),
]);
