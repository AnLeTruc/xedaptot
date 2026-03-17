import { Router } from "express";
import { addToWishlist } from "../controllers/wishlistController";
import { verifyToken, requireUser } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { addToWishlistSchema } from "../validations/wishlistValidation";

const router = Router();

router.post('/', validate(addToWishlistSchema, 'body'), verifyToken, requireUser, addToWishlist);

export default router;