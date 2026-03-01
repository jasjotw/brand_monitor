import { Router } from 'express';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import {
    getAudienceProfile,
    generateAudiencePersonas,
    generateAudienceIcp,
    generateAudienceBaseQuery,
    generateAudiencePrompts,
    updateAudienceProfile,
} from '../controllers/audience.controller';

const router = Router();

router.get('/current', jwtAuthMiddleware, getAudienceProfile);
router.post('/generate-personas', jwtAuthMiddleware, generateAudiencePersonas);
router.post('/generate-icp', jwtAuthMiddleware, generateAudienceIcp);
router.post('/generate-base-query', jwtAuthMiddleware, generateAudienceBaseQuery);
router.post('/generate-prompts', jwtAuthMiddleware, generateAudiencePrompts);
router.put('/current', jwtAuthMiddleware, updateAudienceProfile);

export default router;
