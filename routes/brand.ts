import { Router } from "express";
import { getAllBrands, createBrand, updateBrand, deleteBrand } from "../controllers/brandController";

const router = Router();

router.get('/', getAllBrands);
router.post('/', createBrand);
router.put('/:id', updateBrand);
router.delete('/:id', deleteBrand);

export default router;
