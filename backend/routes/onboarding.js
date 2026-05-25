const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const { authenticate } = require('../middleware/auth');
const { runVelAiOnboardingChat, isVelAiConfigured } = require('../services/velaiOnboardingChat');

const router = express.Router();

const velaiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many VelAI requests. Please wait a moment.' }
});

router.get('/velai-status', authenticate, (req, res) => {
    res.json({
        success: true,
        configured: isVelAiConfigured(),
        model: process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4.1-mini',
        endpoint: process.env.GITHUB_MODELS_ENDPOINT || 'https://models.github.ai/inference'
    });
});

router.post(
    '/velai-chat',
    authenticate,
    velaiLimiter,
    [
        body('form').optional().isObject(),
        body('messages').optional().isArray(),
        body('userMessage').optional().isString().isLength({ max: 4000 }),
        body('bootstrap').optional().isBoolean()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            const result = await runVelAiOnboardingChat({
                form: req.body.form || {},
                messages: req.body.messages || [],
                userMessage: req.body.userMessage || '',
                bootstrap: Boolean(req.body.bootstrap)
            });

            res.json({ success: true, ...result });
        } catch (error) {
            console.error('[VelAI] route error:', error);
            res.status(500).json({
                success: false,
                message: 'VelAI is temporarily unavailable. Try Manual setup or retry shortly.'
            });
        }
    }
);

module.exports = router;
