const OpenAI = require('openai');

const DEFAULT_ENDPOINT = 'https://models.github.ai/inference';
const DEFAULT_MODEL = 'openai/gpt-4.1-mini';
const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const WORKFLOWS = ['coding', 'debugging', 'research', 'automation'];

const isConfigured = () => Boolean(process.env.GITHUB_TOKEN?.trim());

const normalizeField = (value) => String(value || '').trim();

const isFormProfileComplete = (form) => {
    if (!form?.accountType) return false;
    if (!normalizeField(form.name)) return false;
    if (!normalizeField(form.title)) return false;
    if (form.accountType === 'company' && !normalizeField(form.company)) return false;
    if (!normalizeField(form.workspaceName)) return false;
    if (!normalizeField(form.industry)) return false;
    if (form.accountType === 'company' && !form.companySize) return false;
    if (!normalizeField(form.primaryUseCase)) return false;
    return true;
};

const buildCompletionResponse = (form, poweredBy = 'github-models') => {
    const name = normalizeField(form.name);
    const greeting = name ? `, ${name}` : '';
    return {
        message: `You're all set${greeting}! Press **Continue** below — you'll pick your avatar on the next screen.`,
        patch: {},
        complete: true,
        widget: null,
        quickReplies: [],
        model: process.env.GITHUB_MODELS_MODEL?.trim() || DEFAULT_MODEL,
        poweredBy
    };
};

const getClient = () => {
    const token = process.env.GITHUB_TOKEN?.trim();
    if (!token) {
        throw new Error('GITHUB_TOKEN is not configured');
    }

    return new OpenAI({
        apiKey: token,
        baseURL: process.env.GITHUB_MODELS_ENDPOINT?.trim() || DEFAULT_ENDPOINT
    });
};

const buildSystemPrompt = (form) => {
    const snapshot = {
        accountType: form.accountType || null,
        name: form.name || null,
        title: form.title || null,
        company: form.company || null,
        workspaceName: form.workspaceName || null,
        industry: form.industry || null,
        companySize: form.companySize || null,
        primaryUseCase: form.primaryUseCase || null,
        agents: form.agents || {}
    };

    return `You are VelAI, the friendly onboarding assistant for Velocity Brain (coding-agent memory workspace).

Goal: collect profile + workspace details through natural conversation. Be concise, warm, one question at a time when possible.

IMPORTANT: Avatar and workspace image are chosen on a separate screen after this chat. Never ask for avatar, profile photo, or image URLs. Never set avatarUrl or workspaceImageUrl in patch. Never use widget "avatar".

Current captured data (JSON):
${JSON.stringify(snapshot, null, 2)}

Required fields:
- accountType: "company" | "individual"
- name (full name)
- title (role)
- company (required for company accounts; optional for individual — empty string if skipped)
- workspaceName
- industry
- companySize (company only; one of ${COMPANY_SIZES.join(', ')})
- primaryUseCase

Optional enrichment in patch.agents.primaryWorkflow: one of ${WORKFLOWS.join(', ')} inferred from use case.

When all required fields are filled and user confirms, set complete=true. Tell the user they will pick an avatar on the next screen.

Widgets (show UI controls in chat — set exactly one or null):
- "company_size" — pick team size
- "account_type" — company vs individual
- "workflow" — primary workflow chips
- null — no widget

Respond with ONLY valid JSON (no markdown fences):
{
  "message": "string, user-facing reply, may use **bold** sparingly",
  "patch": { "optional partial fields to merge" },
  "complete": false,
  "widget": null,
  "quickReplies": ["optional short suggestions, max 4"]
}

Rules:
- patch only includes fields you are confident about from the latest user message
- never invent email or passwords
- if user says yes/confirm and data is complete, complete=true with ONE short message (do not repeat prior completion text)
- if all required fields are already filled in the snapshot, set complete=true immediately with a single short message
- if user wants to change a field, update patch and complete=false
- keep message under 120 words`;
};

const extractJson = (text) => {
    const raw = String(text || '').trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced) {
            try {
                return JSON.parse(fenced[1].trim());
            } catch {
                return null;
            }
        }

        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(raw.slice(start, end + 1));
            } catch {
                return null;
            }
        }
    }

    return null;
};

const sanitizePatch = (patch, form) => {
    if (!patch || typeof patch !== 'object') return {};

    const next = {};
    const accountType = String(patch.accountType || '').toLowerCase();
    if (accountType === 'company' || accountType === 'individual') {
        next.accountType = accountType;
    }

    const stringFields = ['name', 'title', 'company', 'workspaceName', 'industry', 'primaryUseCase'];
    for (const key of stringFields) {
        if (typeof patch[key] === 'string') {
            next[key] = patch[key].trim().slice(0, 500);
        }
    }

    if (COMPANY_SIZES.includes(patch.companySize)) {
        next.companySize = patch.companySize;
    }

    if (patch.agents && typeof patch.agents === 'object') {
        const workflow = String(patch.agents.primaryWorkflow || '').toLowerCase();
        if (WORKFLOWS.includes(workflow)) {
            next.agents = { ...(form.agents || {}), primaryWorkflow: workflow };
        }
    }

    return next;
};

const sanitizeResponse = (parsed, form) => {
    const patch = sanitizePatch(parsed?.patch, form);
    const widgetWhitelist = new Set(['company_size', 'account_type', 'workflow', null]);
    let widget = parsed?.widget ?? null;
    if (!widgetWhitelist.has(widget)) {
        widget = null;
    }

    const quickReplies = Array.isArray(parsed?.quickReplies)
        ? parsed.quickReplies.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
        : [];

    return {
        message: String(parsed?.message || 'Thanks — tell me a bit more.').trim().slice(0, 2000),
        patch,
        complete: Boolean(parsed?.complete),
        widget,
        quickReplies,
        model: process.env.GITHUB_MODELS_MODEL?.trim() || DEFAULT_MODEL,
        poweredBy: 'github-models'
    };
};

const ruleBasedFallback = (form, userMessage, bootstrap) => {
    const lower = String(userMessage || '').toLowerCase();

    if (bootstrap) {
        const opener = form.accountType
            ? `Hi! I'm VelAI. Let's finish your ${form.accountType === 'company' ? 'team' : 'personal'} workspace — what's your full name?`
            : 'Hi! I\'m VelAI. Is this setup for a **company team** or **just you** (individual)?';
        return {
            message: opener,
            patch: {},
            complete: false,
            widget: form.accountType ? null : 'account_type',
            quickReplies: form.accountType ? [] : ['Company / team', 'Just me — individual'],
            model: 'fallback',
            poweredBy: 'local'
        };
    }

    const patch = {};
    if (/\b(company|team)\b/.test(lower)) patch.accountType = 'company';
    if (/\b(individual|solo|just me)\b/.test(lower)) patch.accountType = 'individual';
    if (userMessage && userMessage.length > 2 && !patch.accountType) {
        if (!form.name) patch.name = userMessage.trim();
        else if (!form.title) patch.title = userMessage.trim();
        else if (!form.workspaceName) patch.workspaceName = userMessage.trim();
    }

    return {
        message: 'Got it — keep going, or switch to the **Manual** tab for direct field entry.',
        patch,
        complete: false,
        widget: null,
        quickReplies: [],
        model: 'fallback',
        poweredBy: 'local'
    };
};

async function runVelAiOnboardingChat({ form = {}, messages = [], userMessage = '', bootstrap = false }) {
    const safeForm = form && typeof form === 'object' ? form : {};

    if (isFormProfileComplete(safeForm)) {
        const poweredBy = isConfigured() ? 'github-models' : 'local';
        if (bootstrap || userMessage) {
            return buildCompletionResponse(safeForm, poweredBy);
        }
    }

    if (!isConfigured()) {
        return ruleBasedFallback(safeForm, userMessage, bootstrap);
    }

    const client = getClient();
    const model = process.env.GITHUB_MODELS_MODEL?.trim() || DEFAULT_MODEL;
    const chatMessages = [
        { role: 'system', content: buildSystemPrompt(safeForm) }
    ];

    for (const entry of messages) {
        if (!entry?.role || !entry?.content) continue;
        if (entry.role === 'user' || entry.role === 'assistant') {
            chatMessages.push({ role: entry.role, content: String(entry.content).slice(0, 4000) });
        }
    }

    if (bootstrap && !userMessage) {
        chatMessages.push({
            role: 'user',
            content: 'Start onboarding. Greet the user and ask for the next missing required field.'
        });
    } else if (userMessage) {
        chatMessages.push({ role: 'user', content: String(userMessage).slice(0, 4000) });
    }

    try {
        const response = await client.chat.completions.create({
            model,
            temperature: 0.65,
            top_p: 1,
            messages: chatMessages
        });

        const content = response.choices?.[0]?.message?.content || '';
        const parsed = extractJson(content);

        if (!parsed) {
            return {
                message: content.trim() || 'I had trouble formatting that — could you rephrase?',
                patch: {},
                complete: false,
                widget: null,
                quickReplies: [],
                model,
                poweredBy: 'github-models'
            };
        }

        const sanitized = sanitizeResponse(parsed, safeForm);
        if (sanitized.complete && isFormProfileComplete({ ...safeForm, ...sanitized.patch })) {
            return buildCompletionResponse({ ...safeForm, ...sanitized.patch });
        }
        return sanitized;
    } catch (error) {
        console.error('[VelAI] GitHub Models error:', error?.message || error);
        const fallback = ruleBasedFallback(safeForm, userMessage, bootstrap);
        fallback.message = `${fallback.message} (AI unavailable — using basic mode.)`;
        return fallback;
    }
}

module.exports = {
    runVelAiOnboardingChat,
    isVelAiConfigured: isConfigured
};
