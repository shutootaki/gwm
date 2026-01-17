import { describe, it, expect } from 'vitest';
import { generateShellIntegrationScript } from '../src/utils/shellIntegration.js';

describe('shell integration script', () => {
  it('should generate zsh script with GWM_CWD_FILE integration', () => {
    const script = generateShellIntegrationScript('zsh', {
      nodePath: '/opt/node/bin/node',
      scriptPath: '/opt/gwm/dist/index.js',
    });

    expect(script).toContain('eval "$(gwm init zsh)"');
    expect(script).toContain("local gwm_node='/opt/node/bin/node'");
    expect(script).toContain("local gwm_script='/opt/gwm/dist/index.js'");
    expect(script).toContain('GWM_CWD_FILE');
    expect(script).toContain('mktemp');
    expect(script).toContain('builtin cd');
  });

  it('should generate fish script with GWM_CWD_FILE integration', () => {
    const script = generateShellIntegrationScript('fish', {
      nodePath: '/opt/node/bin/node',
      scriptPath: '/opt/gwm/dist/index.js',
    });

    expect(script).toContain('gwm init fish | source');
    expect(script).toContain("set -l gwm_node '/opt/node/bin/node'");
    expect(script).toContain("set -l gwm_script '/opt/gwm/dist/index.js'");
    expect(script).toContain('GWM_CWD_FILE');
    expect(script).toContain('mktemp');
    expect(script).toContain('builtin cd');
  });
});

