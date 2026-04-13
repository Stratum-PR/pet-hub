import { Navigate } from 'react-router-dom';

/** Legacy URL after email confirmation; new signups complete in the join modal on the home page. */
export function WaitlistConfirmed() {
  return <Navigate to="/" replace />;
}
