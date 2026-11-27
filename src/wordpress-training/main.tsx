import { createRoot } from 'react-dom/client';
import { WordPressTraining } from './WordPressTraining';
import './training.css';

const host = document.querySelector('[data-cubing-training]');
if (host) createRoot(host).render(<WordPressTraining />);
