import { Router } from "express";
import { createUserHandlers } from "../controllers/userController.js";
import { createTodoHandlers } from "../controllers/todoController.js";
import { dailyEnglishPhrases } from "../data/dailyEnglishPhrases.js";

export function createApiRouter(collectionProvider, todoCollectionProvider) {
  const router = Router();
  const { listUsers, getUserById } = createUserHandlers(collectionProvider);
  const { listTodos, getTodoById } = createTodoHandlers(todoCollectionProvider);

  // Public read-only demo endpoints. Do not add write routes without authentication.
  router.get("/users", listUsers);
  router.get("/users/:id", getUserById);
  router.get("/todos", listTodos);
  router.get("/todos/:id", getTodoById);
  router.get("/english-phrases", (_req, res) => res.json(dailyEnglishPhrases));

  return router;
}
