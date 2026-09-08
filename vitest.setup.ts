import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers this when vitest runs with `globals: true`,
// which this project does not. Without it, each render stacks on the previous
// test's DOM and queries find duplicates.
afterEach(cleanup);
