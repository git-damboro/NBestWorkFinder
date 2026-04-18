import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * 公开路由守卫。
 *
 * 已登录用户再次访问登录/注册页时，直接回到业务首页。
 */
export default function PublicRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/upload" replace />;
  }

  return <Outlet />;
}
