import { isVelAiInfoComplete, mergeVelAiPatch } from './velaiOnboarding';

const baseForm = {
  accountType: 'company',
  name: 'Jane Doe',
  title: 'Engineer',
  company: 'Acme',
  workspaceName: 'Acme Brain',
  industry: 'Software',
  companySize: '11-50',
  primaryUseCase: 'Coding'
};

describe('velaiOnboarding helpers', () => {
  it('merges nested agents patch', () => {
    const merged = mergeVelAiPatch({ agents: { primaryWorkflow: 'coding' } }, {
      agents: { primaryWorkflow: 'research' }
    });
    expect(merged.agents.primaryWorkflow).toBe('research');
  });

  it('is complete when server flag is true', () => {
    expect(isVelAiInfoComplete({ name: '' }, true)).toBe(true);
  });

  it('does not require avatar for VelAI chat completion', () => {
    expect(isVelAiInfoComplete(baseForm)).toBe(true);
    expect(isVelAiInfoComplete({ ...baseForm, name: '' })).toBe(false);
  });
});
