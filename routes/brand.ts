import { Router } from "express";
import { getAllBrands, createBrand, updateBrand } from "../controllers/brandController";

const router = Router();

router.get('/', getAllBrands);
router.post('/', createBrand);
router.put('/:id', updateBrand);

export default router;
