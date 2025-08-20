import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Developers } from '@/pages/Developers'
import { Teams } from '@/pages/Teams'
import { Roles } from '@/pages/Roles'
import { Stacks } from '@/pages/Stacks'
import { Repositories } from '@/pages/Repositories'
import { Sync } from '@/pages/Sync'
import { RepositoryConfiguration } from '@/pages/RepositoryConfiguration'


function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="developers" element={<Developers />} />
        <Route path="teams" element={<Teams />} />
        <Route path="roles" element={<Roles />} />
        <Route path="stacks" element={<Stacks />} />
        <Route path="repositories" element={<Repositories />} />
        <Route path="sync" element={<Sync />} />
        <Route path="azure-devops" element={<RepositoryConfiguration />} />

      </Route>
    </Routes>
  )
}

export default App
