import { Router } from 'express';
import {
    brandExists,
    createBrandProfile,
    getCurrentBrandProfile,
    getPersonas,
    createPersonas,
} from '../controllers/brand-profile.controller';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';

const router = Router();

router.get('/exists', jwtAuthMiddleware, brandExists);
router.get('/current', jwtAuthMiddleware, getCurrentBrandProfile);
router.get('/get-personas', jwtAuthMiddleware, getPersonas);
router.post('/create-personas', jwtAuthMiddleware, createPersonas);
router.post('/', jwtAuthMiddleware, createBrandProfile);

export default router;
