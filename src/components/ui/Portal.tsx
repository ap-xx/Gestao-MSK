import { createPortal } from 'react-dom';
import { type ReactNode } from 'react';

/** Renders children directly under document.body, escaping any CSS
 *  containing-block created by scroll containers or transforms in the
 *  app layout.  Use this to wrap every modal overlay. */
export default function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
