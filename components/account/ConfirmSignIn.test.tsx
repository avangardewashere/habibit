// @vitest-environment jsdom
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyLink = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams();

vi.mock('@/lib/auth/actions', () => ({ verifyLink: (hash: string) => verifyLink(hash) }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => search,
  useRouter: () => ({ replace }),
}));

import { ConfirmSignIn } from './ConfirmSignIn';

beforeEach(() => {
  verifyLink.mockReset();
  replace.mockReset();
});

describe('the sign-in link landing page', () => {
  it('V2C-33 · ⭐ checks a one-time link exactly once, even when StrictMode runs the effect twice', async () => {
    // A second check of the same token would fail and tell someone who has just
    // signed in that their link "expired".
    search = new URLSearchParams('token_hash=abc123&type=email');
    verifyLink.mockResolvedValue({ ok: true });

    render(
      <StrictMode>
        <ConfirmSignIn />
      </StrictMode>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(verifyLink).toHaveBeenCalledTimes(1);
    expect(verifyLink).toHaveBeenCalledWith('abc123');
  });

  it('V2C-34 · shows the reason when the link does not work, and offers a way back', async () => {
    search = new URLSearchParams('token_hash=used-already&type=email');
    verifyLink.mockResolvedValue({ ok: false, message: 'That code or link has expired or was already used.' });

    render(<ConfirmSignIn />);

    expect(await screen.findByText('That code or link has expired or was already used.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Habibit' })).toHaveAttribute('href', '/');
    expect(replace).not.toHaveBeenCalled();
  });
});
