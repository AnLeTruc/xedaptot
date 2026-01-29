import { Router } from "express";
import { getAllBrands, createBrand, updateBrand, deleteBrand } from "../controllers/brandController";
import {
    createBrandSchema,
    updateBrandSchema,
    brandIdParamSchema
} from "../validations/brandValidation";
import { validate } from "../middleware/validate";
import { verifyToken, requireUser } from "../middleware/auth";

const router = Router();

router.get('/', getAllBrands);
router.post('/', validate(createBrandSchema, 'body'), verifyToken, requireUser, createBrand);
router.put('/:id', validate(brandIdParamSchema, 'params'), validate(updateBrandSchema, 'body'), verifyToken, requireUser, updateBrand);
router.delete('/:id', validate(brandIdParamSchema, 'params'), verifyToken, requireUser, deleteBrand);

export default router;
