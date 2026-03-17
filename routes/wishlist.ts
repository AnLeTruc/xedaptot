import { Router } from "express";
import { addToWishlist, removeFromWishlist } from "../controllers/wishlistController";
import { verifyToken, requireUser } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { addToWishlistSchema, wishlistBicycleParamSchema } from "../validations/wishlistValidation";

const router = Router();

router.post('/', validate(addToWishlistSchema, 'body'), verifyToken, requireUser, addToWishlist);
router.delete('/:bicycleId', validate(wishlistBicycleParamSchema, 'params'), verifyToken, requireUser, removeFromWishlist);
export default router;