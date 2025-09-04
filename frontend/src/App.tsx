import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Developers } from '@/pages/Developers'
import { Teams } from '@/pages/Teams'
import { Roles } from '@/pages/Roles'
import { Stacks } from '@/pages/Stacks'
import { Repositories } from '@/pages/Repositories'
import { Sync } from '@/pages/Sync'
import { RepositoryConfiguration } from '@/pages/RepositoryConfiguration'
import { Login } from '@/pages/Login'
import { Users } from '@/pages/Users'
import { UserRoles } from '@/pages/UserRoles'
import { AccessDenied } from '@/pages/AccessDenied'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PermissionRoute } from '@/components/PermissionRoute'

function App() {
  return (
    <Routes>
      {/* Rota pública de login */}
      <Route path="/login" element={<Login />} />
      
      {/* Rota de acesso negado */}
      <Route path="/access-denied" element={<AccessDenied />} />
      
      {/* Rotas protegidas */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        
        {/* Dashboard */}
        <Route path="dashboard" element={
          <PermissionRoute permission="dashboard:read">
            <Dashboard />
          </PermissionRoute>
        } />
        
        {/* Desenvolvedores */}
        <Route path="developers" element={
          <PermissionRoute permission="developers:read">
            <Developers />
          </PermissionRoute>
        } />
        
        {/* Times */}
        <Route path="teams" element={
          <PermissionRoute permission="teams:read">
            <Teams />
          </PermissionRoute>
        } />
        
        {/* Cargos */}
        <Route path="roles" element={
          <PermissionRoute permission="job-roles:read">
            <Roles />
          </PermissionRoute>
        } />
        
        {/* Stacks */}
        <Route path="stacks" element={
          <PermissionRoute permission="stacks:read">
            <Stacks />
          </PermissionRoute>
        } />
        
        {/* Repositórios */}
        <Route path="repositories" element={
          <PermissionRoute permission="repositories:read">
            <Repositories />
          </PermissionRoute>
        } />
        
        {/* Usuários */}
        <Route path="users" element={
          <PermissionRoute permission="users:read">
            <Users />
          </PermissionRoute>
        } />
        
        {/* Roles de Usuário */}
        <Route path="user-roles" element={
          <PermissionRoute permission="roles:read">
            <UserRoles />
          </PermissionRoute>
        } />
        
        {/* Sincronização */}
        <Route path="sync" element={
          <PermissionRoute permission="sync:read">
            <Sync />
          </PermissionRoute>
        } />
        
        {/* Azure DevOps */}
        <Route path="azure-devops" element={
          <PermissionRoute permission="azure-devops:read">
            <RepositoryConfiguration />
          </PermissionRoute>
        } />
      </Route>
    </Routes>
  )
}

export default App
