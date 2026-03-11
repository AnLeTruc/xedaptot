import { Router } from 'express';
import {
    createRestrictedWord,
    getRestrictedWords,
    updateRestrictedWord,
    deleteRestrictedWord
} from '../../controllers/admin/restrictedWordController';
import { verifyToken, requireAdmin } from '../../middleware/auth';

const router = Router();

router.use(verifyToken, requireAdmin);

router.post('/restricted-words', createRestrictedWord);
router.get('/restricted-words', getRestrictedWords);
router.put('/restricted-words/:id', updateRestrictedWord);
router.delete('/restricted-words/:id', deleteRestrictedWord);

export default router;
