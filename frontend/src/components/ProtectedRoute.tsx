// Redirects unauthenticated users to /login before they can access protected pages
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../services/auth';

interface Props {
    children: React.ReactNode;
}

function ProtectedRoute({ children }: Props) {
    if (!isAuthenticated()) {
        // User has no token — send them to login
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

export default ProtectedRoute;