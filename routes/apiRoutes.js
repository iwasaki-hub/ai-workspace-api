import { Router } from "express";
import { createUserHandlers } from "../controllers/userController.js";

export function createApiRouter(collectionProvider) {
  const router = Router();
  const { listUsers, getUserById } = createUserHandlers(collectionProvider);

  // Public read-only demo endpoints. Do not add write routes without authentication.
  router.get("/users", listUsers);
  router.get("/users/:id", getUserById);

  return router;
}
