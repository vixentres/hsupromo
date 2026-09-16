import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PromoterLogin from './pages/PromoterLogin';
import PromoterDashboard from './pages/PromoterDashboard';
import AdminPanel from './pages/AdminPanel';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-red-500/30">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/promotor/login" element={<PromoterLogin />} />
          <Route path="/promotor/dashboard" element={<PromoterDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
