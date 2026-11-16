import { Router } from 'express';
import * as c from '../controllers/profile.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { onboardingSchema, foodSchema, favoriteSchema, weightSchema } from '../validators/index.js';

const router = Router();
router.use(auth);
router.get('/', c.getProfile);
router.put('/onboarding', validate(onboardingSchema), c.saveOnboarding);
router.post('/foods', validate(foodSchema), c.addFood);
router.delete('/foods/:foodId', c.removeFood);
router.post('/favorites', validate(favoriteSchema), c.addFavorite);
router.put('/favorites/:favId', validate(favoriteSchema), c.updateFavorite);
router.delete('/favorites/:favId', c.removeFavorite);
router.get('/weights', c.getWeights);
router.post('/weights', validate(weightSchema), c.addWeight);
router.delete('/weights/:date', c.removeWeight);
export default router;
