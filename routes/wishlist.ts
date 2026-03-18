import { Router } from "express";
import { addToWishlist, removeFromWishlist, checkWishlist, getMyWishlist } from "../controllers/wishlistController";
import { verifyToken, requireUser } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { addToWishlistSchema, wishlistBicycleParamSchema, getWishlistQuerySchema } from "../validations/wishlistValidation";

const router = Router();

router.post('/', validate(addToWishlistSchema, 'body'), verifyToken, requireUser, addToWishlist);
router.get('/', validate(getWishlistQuerySchema, 'query'), verifyToken, requireUser, getMyWishlist);
router.delete('/:bicycleId', validate(wishlistBicycleParamSchema, 'params'), verifyToken, requireUser, removeFromWishlist);
router.get('/:bicycleId', validate(wishlistBicycleParamSchema, 'params'), verifyToken, requireUser, checkWishlist);
export default router;