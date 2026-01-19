import { Router } from "express";
import { getAllBrands, createBrand } from "../controllers/brandController";
import { verifyToken, requireUser } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";

const router = Router();

// Public route - anyone can view brands
router.get('/', getAllBrands);

// Admin only - create new brand
router.post('/', verifyToken, requireUser, requireAdmin, createBrand);

export default router;
