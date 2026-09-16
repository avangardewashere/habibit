// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// A build with no Supabase settings: a fork, a preview, or before accounts are set up.
vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => null,
}));

import { AccountMenu } from './AccountMenu';

describe('AccountMenu without Supabase settings', () => {
  it('V2C-32 · renders nothing, so the app looks exactly like it did before accounts', () => {
    const { container } = render(<AccountMenu />);
    expect(container).toBeEmptyDOMElement();
  });
});
