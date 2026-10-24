import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store';
import Layout from './components/Layout';
import Assistant from './components/Assistant';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewConversion from './pages/NewConversion';
import Documents from './pages/Documents';
import Analysis from './pages/Analysis';
import Adjustments from './pages/Adjustments';
import AdjustmentDetail from './pages/AdjustmentDetail';
import Statements from './pages/Statements';
import Norms from './pages/Norms';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import About from './pages/About';
import { Spinner } from './components/ui';

function Gate() {
  const { user, loading } = useApp();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Chargement de la plateforme…" />
      </div>
    );
  }
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nouvelle-conversion" element={<NewConversion />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/analyse" element={<Analysis />} />
          <Route path="/retraitements" element={<Adjustments />} />
          <Route path="/retraitements/:ref" element={<AdjustmentDetail />} />
          <Route path="/etats-financiers" element={<Statements />} />
          <Route path="/normes" element={<Norms />} />
          <Route path="/rapports" element={<Reports />} />
          <Route path="/parametres" element={<Settings />} />
          <Route path="/a-propos" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Assistant />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AppProvider>
  );
}
