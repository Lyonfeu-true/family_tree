import type { ReactElement } from 'react';

/**
 * Composition root. In later phases this builds the infrastructure adapters, injects
 * them into the use cases, and provides them to the presentation layer. It is the only
 * place allowed to import from every layer.
 */
export function App(): ReactElement {
  return (
    <main className="app-placeholder">
      <h1>Family Tree</h1>
      <p>Project scaffold is running.</p>
    </main>
  );
}
