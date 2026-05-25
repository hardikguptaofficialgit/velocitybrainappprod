export const COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

export const WORKFLOW_OPTIONS = [
  { value: 'coding', label: 'Coding' },
  { value: 'debugging', label: 'Debugging' },
  { value: 'research', label: 'Research' },
  { value: 'automation', label: 'Automation' }
];

const normalize = (value) => String(value || '').trim();

export function mergeVelAiPatch(form, patch) {
  if (!patch || typeof patch !== 'object') return form;
  const next = { ...form, ...patch };
  if (patch.agents) {
    next.agents = { ...(form.agents || {}), ...patch.agents };
  }
  if (form.accountType === 'individual' && patch.company === undefined) {
    // keep
  }
  if (next.accountType === 'individual') {
    next.companySize = next.companySize || '';
  }
  return next;
}

export function isVelAiInfoComplete(form, serverComplete = false) {
  if (serverComplete) return true;
  if (!form.accountType) return false;
  if (!normalize(form.name)) return false;
  if (!normalize(form.title)) return false;
  if (form.accountType === 'company' && !normalize(form.company)) return false;
  if (!normalize(form.workspaceName)) return false;
  if (!normalize(form.industry)) return false;
  if (form.accountType === 'company' && !form.companySize) return false;
  if (!normalize(form.primaryUseCase)) return false;
  return true;
}

export function inferWorkspaceLabel(form) {
  if (normalize(form.workspaceName)) return form.workspaceName.trim();
  if (form.accountType === 'company' && normalize(form.company)) return form.company.trim();
  if (normalize(form.name)) return `${form.name.trim()}'s Workspace`;
  return 'Workspace';
}

/** @deprecated local-only fallback */
export function getActiveVelAiPhase(form) {
  if (!form.accountType) return 'accountType';
  if (!normalize(form.name)) return 'name';
  if (!normalize(form.title)) return 'title';
  if (form.accountType === 'company' && !normalize(form.company)) return 'company';
  if (!normalize(form.workspaceName)) return 'workspaceName';
  if (!normalize(form.industry)) return 'industry';
  if (form.accountType === 'company' && !form.companySize) return 'companySize';
  if (!normalize(form.primaryUseCase)) return 'primaryUseCase';
  return 'confirm';
}

export function buildVelAiSummary(form) {
  const lines = [
    `**Account:** ${form.accountType === 'company' ? 'Company' : 'Individual'}`,
    `**Name:** ${normalize(form.name) || '—'}`,
    `**Role:** ${normalize(form.title) || '—'}`,
    `**Workspace:** ${normalize(form.workspaceName) || inferWorkspaceLabel(form)}`
  ];
  if (normalize(form.company)) lines.push(`**Company:** ${form.company}`);
  if (normalize(form.industry)) lines.push(`**Industry:** ${form.industry}`);
  if (form.companySize) lines.push(`**Size:** ${form.companySize}`);
  if (normalize(form.primaryUseCase)) lines.push(`**Use case:** ${form.primaryUseCase}`);
  return lines.join('\n');
}
