// Setup for component tests (the "dom" Vitest project, *.test.tsx): jest-dom matchers such as
// toBeInTheDocument / toBeDisabled, and unmounting rendered trees after each test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
