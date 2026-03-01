import { Router } from 'express';
import * as authController from './auth.controller';
import { jwtAuthMiddleware } from '../../middleware/jwt-auth.middleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', jwtAuthMiddleware, authController.getMe);
router.post('/refresh', jwtAuthMiddleware, authController.refresh);

export default router;
