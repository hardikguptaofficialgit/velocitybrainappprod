const express = require('express');
const { body, validationResult } = require('express-validator');

const { db, COLLECTIONS, firebaseInitialized } = require('../config/firebase');
const { cloudinary, cloudinaryReady } = require('../config/cloudinary');
const { authenticate } = require('../middleware/auth');
const {
    ACCOUNT_TYPES,
    WORKSPACE_IMAGE_TARGET,
    PROFILE_IMAGE_TARGET,
    buildDefaultUserSettings,
    buildWorkspacePayload,
    inferWorkspaceName,
    mergeSettings,
    sanitizeAllowedOrigins,
    sanitizeAvatarUrl,
    sanitizeText,
    sanitizeUrl,
    sanitizeWorkspaceUpdate,
    toPublicUser,
    toPublicWorkspace
} = require('../utils/account');

const router = express.Router();

const ensureFirebase = (res) => {
    if (!firebaseInitialized) {
        res.status(503).json({
            success: false,
            message: 'Firebase not configured. Please set up Firebase credentials.'
        });
        return false;
    }
    return true;
};

const getUserDoc = async (userId) => db.collection(COLLECTIONS.USERS).doc(userId).get();

const getSettingsDoc = async (userId) => {
    const ref = db.collection(COLLECTIONS.USER_SETTINGS).doc(userId);
    const doc = await ref.get();
    if (!doc.exists) {
        const payload = buildDefaultUserSettings();
        await ref.set(payload);
        return { id: userId, data: payload, ref };
    }
    return { id: userId, data: mergeSettings(doc.data()), ref };
};

const getWorkspaceDoc = async (workspaceId) => {
    if (!workspaceId) return null;
    const doc = await db.collection(COLLECTIONS.WORKSPACES).doc(workspaceId).get();
    if (!doc.exists) return null;
    return doc;
};

const destroyCloudinaryAsset = async (publicId) => {
    if (!cloudinaryReady || !publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
    } catch (error) {
        console.warn('Failed to clean previous Cloudinary asset', publicId, error.message);
    }
};

const parseImageData = (imageData) => {
    if (typeof imageData !== 'string') {
        throw new Error('Image payload is required');
    }
    const match = imageData.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
        throw new Error('Unsupported image format. Use PNG, JPEG, WEBP, or GIF.');
    }
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length) {
        throw new Error('Image file is empty');
    }
    if (buffer.length > 5 * 1024 * 1024) {
        throw new Error('Image file must be 5MB or smaller');
    }
    return { mimeType, buffer };
};

const saveImageUpload = async ({ imageData, target, entityId }) => {
    if (!cloudinaryReady) {
        throw new Error('Cloudinary is not configured on the backend');
    }

    const folder = target === WORKSPACE_IMAGE_TARGET
        ? 'velocitybrain/workspaces'
        : 'velocitybrain/profiles';

    const result = await cloudinary.uploader.upload(imageData, {
        folder,
        public_id: `${entityId}-${Date.now()}`,
        overwrite: true,
        resource_type: 'image',
        invalidate: true
    });

    return {
        publicPath: result.secure_url,
        publicId: result.public_id
    };
};

router.get('/', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const userDoc = await getUserDoc(req.user.id);
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = userDoc.data();
        const settingsDoc = await getSettingsDoc(req.user.id);
        const workspaceDoc = await getWorkspaceDoc(userData.workspace_id);

        res.json({
            success: true,
            user: toPublicUser(userDoc.id, userData),
            workspace: workspaceDoc ? toPublicWorkspace(workspaceDoc.id, workspaceDoc.data()) : null,
            settings: settingsDoc.data
        });
    } catch (error) {
        console.error('Settings fetch error:', error);
        res.status(500).json({ success: false, message: 'Failed to load settings' });
    }
});

router.post('/onboarding', authenticate, [
    body('accountType').isString().trim(),
    body('workspaceName').optional().isString(),
    body('name').optional().isString(),
    body('title').optional().isString(),
    body('company').optional().isString(),
    body('industry').optional().isString(),
    body('companySize').optional().isString(),
    body('website').optional().isString(),
    body('description').optional().isString(),
    body('primaryUseCase').optional().isString(),
    body('timezone').optional().isString(),
    body('avatarUrl').optional().isString(),
    body('workspaceImageUrl').optional().isString(),
    body('notifications').optional().isObject(),
    body('api').optional().isObject()
], async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userDoc = await getUserDoc(req.user.id);
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = userDoc.data();
        const accountType = sanitizeText(req.body.accountType, 40).toLowerCase();
        if (!ACCOUNT_TYPES.has(accountType)) {
            return res.status(400).json({ success: false, message: 'Account type must be company or individual' });
        }

        const displayName = sanitizeText(req.body.name, 120) || userData.name || req.user.name || '';
        const companyName = sanitizeText(req.body.company, 120);
        const nextAvatarUrl = sanitizeAvatarUrl(req.body.avatarUrl) || userData.avatar_url || '';
        const workspaceName = sanitizeText(req.body.workspaceName, 120) || inferWorkspaceName({
            name: displayName,
            email: userData.email,
            accountType,
            companyName
        });

        let workspaceId = userData.workspace_id || '';
        let existingWorkspace = workspaceId ? await getWorkspaceDoc(workspaceId) : null;
        const nextWorkspaceImageUrl = sanitizeAvatarUrl(req.body.workspaceImageUrl) || existingWorkspace?.data()?.image_url || '';

        if (userData.avatar_public_id && userData.avatar_url !== nextAvatarUrl) {
            await destroyCloudinaryAsset(userData.avatar_public_id);
        }

        if (existingWorkspace?.data()?.image_public_id && existingWorkspace.data().image_url !== nextWorkspaceImageUrl) {
            await destroyCloudinaryAsset(existingWorkspace.data().image_public_id);
        }

        const workspacePayload = buildWorkspacePayload({
            name: workspaceName,
            ownerUser: {
                id: req.user.id,
                email: userData.email,
                name: displayName
            },
            accountType,
            industry: req.body.industry,
            companySize: req.body.companySize,
            website: req.body.website,
            description: req.body.description,
            primaryUseCase: req.body.primaryUseCase,
            timezone: req.body.timezone,
            imageUrl: nextWorkspaceImageUrl,
            imagePath: '',
            imagePublicId: ''
        });

        if (!workspaceId) {
            const workspaceRef = await db.collection(COLLECTIONS.WORKSPACES).add(workspacePayload);
            workspaceId = workspaceRef.id;
            existingWorkspace = await workspaceRef.get();
        } else {
            await db.collection(COLLECTIONS.WORKSPACES).doc(workspaceId).set({
                ...(existingWorkspace?.data() || {}),
                ...workspacePayload,
                created_at: existingWorkspace?.data()?.created_at || workspacePayload.created_at,
                updated_at: new Date().toISOString()
            });
            existingWorkspace = await getWorkspaceDoc(workspaceId);
        }

        const settingsDoc = await getSettingsDoc(req.user.id);
        const mergedSettings = mergeSettings({
            ...settingsDoc.data,
            notifications: {
                ...settingsDoc.data.notifications,
                ...(req.body.notifications || {})
            },
            api: {
                ...settingsDoc.data.api,
                ...(req.body.api || {})
            },
            updated_at: new Date().toISOString()
        });
        mergedSettings.api.allowedOrigins = sanitizeAllowedOrigins(mergedSettings.api.allowedOrigins);
        mergedSettings.api.webhookUrl = sanitizeUrl(mergedSettings.api.webhookUrl);
        await settingsDoc.ref.set(mergedSettings);

        await userDoc.ref.update({
            name: displayName,
            title: sanitizeText(req.body.title, 120),
            company: companyName,
            account_type: accountType,
            avatar_url: nextAvatarUrl,
            avatar_path: '',
            avatar_public_id: '',
            workspace_id: workspaceId,
            workspace_ids: Array.from(new Set([...(userData.workspace_ids || []), workspaceId])),
            onboarding_completed: true,
            onboarding_step: 'completed',
            updated_at: new Date().toISOString()
        });

        const updatedUserDoc = await getUserDoc(req.user.id);

        res.json({
            success: true,
            user: toPublicUser(updatedUserDoc.id, updatedUserDoc.data()),
            workspace: existingWorkspace ? toPublicWorkspace(existingWorkspace.id, existingWorkspace.data()) : null,
            settings: mergedSettings
        });
    } catch (error) {
        console.error('Onboarding error:', error);
        res.status(500).json({ success: false, message: 'Failed to complete onboarding' });
    }
});

router.patch('/profile', authenticate, [
    body('name').optional().isString(),
    body('title').optional().isString(),
    body('company').optional().isString(),
    body('avatarUrl').optional().isString()
], async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const userDoc = await getUserDoc(req.user.id);
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const updates = {
            updated_at: new Date().toISOString()
        };

        if (Object.prototype.hasOwnProperty.call(req.body, 'name')) updates.name = sanitizeText(req.body.name, 120);
        if (Object.prototype.hasOwnProperty.call(req.body, 'title')) updates.title = sanitizeText(req.body.title, 120);
        if (Object.prototype.hasOwnProperty.call(req.body, 'company')) updates.company = sanitizeText(req.body.company, 120);
        if (Object.prototype.hasOwnProperty.call(req.body, 'avatarUrl')) {
            const nextAvatarUrl = sanitizeAvatarUrl(req.body.avatarUrl);
            if (nextAvatarUrl && nextAvatarUrl !== userDoc.data().avatar_url && userDoc.data().avatar_public_id) {
                await destroyCloudinaryAsset(userDoc.data().avatar_public_id);
            }
            updates.avatar_url = nextAvatarUrl;
            updates.avatar_path = '';
            updates.avatar_public_id = '';
        }

        await userDoc.ref.update(updates);

        const freshUserDoc = await getUserDoc(req.user.id);
        res.json({
            success: true,
            user: toPublicUser(freshUserDoc.id, freshUserDoc.data())
        });
    } catch (error) {
        console.error('Profile settings update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

router.patch('/workspace', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const userDoc = await getUserDoc(req.user.id);
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const workspaceId = userDoc.data().workspace_id;
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'No workspace found for this account' });
        }

        const workspaceDoc = await getWorkspaceDoc(workspaceId);
        if (!workspaceDoc) {
            return res.status(404).json({ success: false, message: 'Workspace not found' });
        }

        const update = sanitizeWorkspaceUpdate(req.body);
        if (update.imageUrl && update.imageUrl !== workspaceDoc.data().image_url && workspaceDoc.data().image_public_id) {
            await destroyCloudinaryAsset(workspaceDoc.data().image_public_id);
        }
        const nextWorkspace = {
            ...workspaceDoc.data(),
            name: update.name || workspaceDoc.data().name,
            image_url: update.imageUrl || workspaceDoc.data().image_url,
            image_path: update.imageUrl ? '' : workspaceDoc.data().image_path,
            image_public_id: update.imageUrl ? '' : workspaceDoc.data().image_public_id,
            settings: {
                ...(workspaceDoc.data().settings || {}),
                ...update.settings
            },
            updated_at: new Date().toISOString()
        };
        nextWorkspace.slug = nextWorkspace.slug || nextWorkspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        await workspaceDoc.ref.update(nextWorkspace);
        const freshWorkspace = await getWorkspaceDoc(workspaceId);

        res.json({
            success: true,
            workspace: toPublicWorkspace(freshWorkspace.id, freshWorkspace.data())
        });
    } catch (error) {
        console.error('Workspace update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update workspace' });
    }
});

router.patch('/notifications', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const settingsDoc = await getSettingsDoc(req.user.id);
        const nextSettings = mergeSettings({
            ...settingsDoc.data,
            notifications: {
                ...settingsDoc.data.notifications,
                ...(req.body || {})
            },
            updated_at: new Date().toISOString()
        });
        await settingsDoc.ref.set(nextSettings);

        res.json({ success: true, settings: nextSettings });
    } catch (error) {
        console.error('Notification settings update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update notifications' });
    }
});

router.patch('/api', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const settingsDoc = await getSettingsDoc(req.user.id);
        const nextApi = {
            ...settingsDoc.data.api,
            responseStyle: ['normal', 'lite', 'full', 'ultra'].includes(req.body.responseStyle) ? req.body.responseStyle : settingsDoc.data.api.responseStyle,
            webhookUrl: sanitizeUrl(req.body.webhookUrl),
            allowedOrigins: sanitizeAllowedOrigins(req.body.allowedOrigins)
        };

        const nextSettings = mergeSettings({
            ...settingsDoc.data,
            api: nextApi,
            updated_at: new Date().toISOString()
        });
        await settingsDoc.ref.set(nextSettings);

        res.json({ success: true, settings: nextSettings });
    } catch (error) {
        console.error('API settings update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update API settings' });
    }
});

router.post('/upload-image', authenticate, async (req, res) => {
    try {
        if (!ensureFirebase(res)) return;

        const target = sanitizeText(req.body.target, 20).toLowerCase();
        if (![WORKSPACE_IMAGE_TARGET, PROFILE_IMAGE_TARGET].includes(target)) {
            return res.status(400).json({ success: false, message: 'Upload target must be profile or workspace' });
        }

        parseImageData(req.body.imageData);
        const userDoc = await getUserDoc(req.user.id);
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (target === PROFILE_IMAGE_TARGET) {
            const currentPublicId = userDoc.data().avatar_public_id;
            const saved = await saveImageUpload({ imageData: req.body.imageData, target, entityId: req.user.id });
            await destroyCloudinaryAsset(currentPublicId);
            await userDoc.ref.update({
                avatar_url: saved.publicPath,
                avatar_path: '',
                avatar_public_id: saved.publicId,
                updated_at: new Date().toISOString()
            });
            const freshUserDoc = await getUserDoc(req.user.id);
            return res.json({
                success: true,
                imageUrl: saved.publicPath,
                user: toPublicUser(freshUserDoc.id, freshUserDoc.data())
            });
        }

        const workspaceId = userDoc.data().workspace_id;
        if (!workspaceId) {
            return res.status(400).json({ success: false, message: 'Complete onboarding before uploading a workspace image' });
        }

        const workspaceDoc = await getWorkspaceDoc(workspaceId);
        if (!workspaceDoc) {
            return res.status(404).json({ success: false, message: 'Workspace not found' });
        }

        const saved = await saveImageUpload({ imageData: req.body.imageData, target, entityId: workspaceId });
        await destroyCloudinaryAsset(workspaceDoc.data().image_public_id);
        await workspaceDoc.ref.update({
            image_url: saved.publicPath,
            image_path: '',
            image_public_id: saved.publicId,
            updated_at: new Date().toISOString()
        });
        const freshWorkspace = await getWorkspaceDoc(workspaceId);

        res.json({
            success: true,
            imageUrl: saved.publicPath,
            workspace: toPublicWorkspace(freshWorkspace.id, freshWorkspace.data())
        });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to upload image' });
    }
});

module.exports = router;
