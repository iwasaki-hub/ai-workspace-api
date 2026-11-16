import { Router } from "express";
import { getUserById, listUsers } from "../controllers/userController.js";

const router = Router();

// Public read-only demo endpoints. Do not add write routes without authentication.
router.get("/users", listUsers);
router.get("/users/:id", getUserById);

export default router;
