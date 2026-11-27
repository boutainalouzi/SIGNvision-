import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { useTheme } from './hooks/useTheme';
import { HomePage } from './pages/HomePage';
import { TranslatorPage } from './pages/TranslatorPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { AboutPage } from './pages/AboutPage';

export function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col lg:flex-row bg-[#FFFFFF] text-[#111111] dark:bg-[#030304] dark:text-[#FFFFFF]">
        <Sidebar theme={theme} onToggleTheme={toggleTheme} />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/translator" element={<TranslatorPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/dictionary" element={<DictionaryPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
